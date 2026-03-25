// 获取TX短信转发脚本 v2.3.0 (支持多通道同时转发)
// 根据 Loon 官方文档重构

const SCRIPT_VERSION = '2.3.0';
const SCRIPT_DATE = '2026-03-26';

console.log(`📱 短信转发脚本启动 v${SCRIPT_VERSION} (${SCRIPT_DATE})`);

// 获取各个平台的独立配置 (留空表示不启用)
let tgToken = $argument.tg_token || '';
let feishuToken = $argument.feishu_token || '';
let dingToken = $argument.ding_token || '';
let serverChanKey = $argument.server_key || '';
let chenxingUrl = $argument.chenxing_url || '';

// 获取通用配置
let allsms = $argument.allsms !== undefined ? $argument.allsms : true;
let regexstr = $argument.regexstr || '码|碼|code|\\d{4,}';
let senderFilter = $argument.sender_filter || '';
let debugMode = $argument.debug_mode !== undefined ? $argument.debug_mode : false;
let retryCount = parseInt($argument.retry_count || '1');
let timeoutSeconds = parseInt($argument.timeout_seconds || '10');

if (debugMode) console.log('🐛 调试模式已开启');

// 检查发信人号码是否匹配过滤条件
function checkSenderFilter(sender) {
    if (!senderFilter || senderFilter.trim() === '') return true;
    const allowedSenders = senderFilter.split(',').map(s => s.trim()).filter(s => s !== '');
    const isAllowed = allowedSenders.some(allowed => sender === allowed || sender.includes(allowed) || allowed.includes(sender));
    if (debugMode) console.log(`🔍 发信人过滤结果: ${isAllowed ? '✅ 允许' : '❌ 拒绝'} (${sender})`);
    return isAllowed;
}

// 主处理函数
async function main() {
    console.log('🚀 开始处理短信');

    let smsData = getSmsData();
    if (!smsData) {
        console.log('❌ 无法获取短信数据');
        $done();
        return;
    }

    if (!checkSenderFilter(smsData.sender)) {
        console.log('❌ 发信人不在允许列表中，跳过转发');
        $done();
        return;
    }

    if (!allsms && !new RegExp(regexstr).test(smsData.message)) {
        console.log('❌ 短信不匹配正则规则，跳过');
        $done();
        return;
    }

    console.log('✅ 短信检查通过，准备分发通知...');

    // 收集所有需要执行的转发任务
    let tasks = [];

    if (tgToken) {
        console.log('📤 启用 Telegram 转发');
        tasks.push(sendToTelegram(tgToken, smsData));
    }
    if (feishuToken) {
        console.log('📤 启用 飞书 转发');
        tasks.push(sendToFeishu(feishuToken, smsData));
    }
    if (dingToken) {
        console.log('📤 启用 钉钉 转发');
        tasks.push(sendToDingTalk(dingToken, smsData));
    }
    if (serverChanKey) {
        console.log('📤 启用 Server酱 转发');
        tasks.push(sendToServerChan(serverChanKey, smsData));
    }
    if (chenxingUrl) {
        console.log('📤 启用 辰星短信 转发');
        tasks.push(sendToChenXing(chenxingUrl, smsData));
    }

    if (tasks.length === 0) {
        console.log('⚠️ 未配置任何有效的转发目标 (Token均为空)');
        $notification.post('转发取消', '未配置目标', '请在插件参数中至少填写一个平台的Token');
        $done();
        return;
    }

    // 等待所有转发任务完成
    await Promise.all(tasks);
    console.log('🎉 所有启用的转发任务已执行完毕');
    $done();
}

// 获取短信数据 (保持原样)
function getSmsData() {
    if (typeof $request !== 'undefined' && $request.body) {
        try {
            const requestData = JSON.parse($request.body);
            if (requestData.query && requestData.query.message) {
                return {
                    sender: requestData.query.sender || '未知发送方',
                    message: requestData.query.message.text || requestData.query.message
                };
            }
        } catch (error) {
            console.log('❌ 解析 $request.body 失败:', error);
        }
    }
    console.log('⚠️ 使用测试数据 (通常发生在非管家真实请求时)');
    return { sender: '10086', message: '【测试】您的验证码是123456，请在5分钟内输入。' };
}

// --- 以下为各平台组装数据的函数 ---

function sendToTelegram(tokenkey, smsData) {
    const lastDot = tokenkey.lastIndexOf('.');
    if (lastDot === -1) {
        console.log('❌ Telegram Token 格式错误');
        return Promise.resolve();
    }
    const bottoken = tokenkey.substring(0, lastDot).trim();
    const chatid = tokenkey.substring(lastDot + 1).trim();
    const url = `https://api.telegram.org/bot${bottoken}/sendMessage`;
    const text = `📱 **TX短信转发**\n发件人: \`${smsData.sender}\`\n内  容: ${smsData.message}`;
    
    return sendHttpRequest(url, JSON.stringify({ chat_id: chatid, text: text, parse_mode: 'Markdown' }), 'Telegram');
}

function sendToFeishu(hooktoken, smsData) {
    const url = `https://open.feishu.cn/open-apis/bot/v2/hook/${hooktoken}`;
    const text = `📱 TX短信转发\n发件人: ${smsData.sender}\n内  容: ${smsData.message}`;
    return sendHttpRequest(url, JSON.stringify({ msg_type: 'text', content: { text: text } }), '飞书');
}

function sendToDingTalk(config, smsData) {
    const configParts = config.split('.');
    if (configParts.length < 2) return Promise.resolve();
    const keyword = configParts[0].trim();
    const token = configParts[1].trim();
    const url = `https://oapi.dingtalk.com/robot/send?access_token=${token}`;
    const text = `${keyword}\n发件人:${smsData.sender}\n内容:${smsData.message}`;
    return sendHttpRequest(url, JSON.stringify({ msgtype: "text", text: { content: text } }), '钉钉');
}

function sendToServerChan(sendkey, smsData) {
    const url = String(sendkey).startsWith('sctp')
        ? `https://${sendkey.match(/^sctp(\d+)t/)[1]}.push.ft07.com/send/${sendkey}.send`
        : `https://sctapi.ftqq.com/${sendkey}.send`;
    return sendHttpRequest(url, JSON.stringify({ title: "TX短信转发", desp: `发件人:${smsData.sender}\n\n内容:${smsData.message}` }), 'Server酱');
}

function sendToChenXing(server, smsData) {
    let url = server.startsWith('http') ? server : `https://${server}`;
    if (!url.endsWith('/sms')) url += '/sms';
    const codeMatch = smsData.message.match(/验证码[：:]?(\d{6})/);
    const body = {
        sender: smsData.sender,
        message: smsData.message,
        code: codeMatch ? codeMatch[1] : '',
        timestamp: Date.now(),
        source: "loon_sms",
        version: SCRIPT_VERSION
    };
    return sendHttpRequest(url, JSON.stringify(body), '辰星短信');
}

// 核心网络请求封装 (返回 Promise，不再直接调用 $done)
function sendHttpRequest(url, body, platformName, currentRetry = 0) {
    return new Promise((resolve) => {
        const requestConfig = {
            url: url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': `Loon-SMS-Forwarder/${SCRIPT_VERSION}`
            },
            body: body,
            timeout: timeoutSeconds * 1000
        };

        $httpClient.post(requestConfig, function(error, response, data) {
            if (error) {
                console.log(`💥 [${platformName}] 请求错误:`, error);
                if (currentRetry < retryCount - 1) {
                    console.log(`🔄 [${platformName}] 准备重试 (${currentRetry + 1}/${retryCount - 1})...`);
                    setTimeout(() => {
                        resolve(sendHttpRequest(url, body, platformName, currentRetry + 1));
                    }, 2000);
                } else {
                    $notification.post(`${platformName} 转发失败`, '网络错误', String(error));
                    resolve(false);
                }
            } else {
                const statusCode = response?.status || response?.statusCode || 200;
                if (statusCode >= 200 && statusCode < 300) {
                    console.log(`✅ [${platformName}] 推送成功`);
                    if (debugMode) $notification.post(`${platformName} 转发成功`, '', '消息已送达');
                    resolve(true);
                } else {
                    console.log(`⚠️ [${platformName}] 服务器异常状态码: ${statusCode}`);
                    resolve(false);
                }
            }
        });
    });
}

main();
