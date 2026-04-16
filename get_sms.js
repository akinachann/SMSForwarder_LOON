// 获取腾讯手机管家短信转发脚本 v2.6.2 (最终稳定全功能版)
// 作者: akinachan & Gemini & Claude

const SCRIPT_VERSION = '2.6.2';
const SCRIPT_DATE = '2026-04-16';

console.log(`📱 短信转发脚本启动 v${SCRIPT_VERSION} (${SCRIPT_DATE})`);

const args = typeof $argument !== 'undefined' ? $argument : {};

// --- 独立配置解析 (完全兼容原有参数) ---
let tgToken = args.tg_token || '';
let feishuToken = args.feishu_token || '';
let webhook1 = args.webhook_url_1 || ''; // NotifyMe UUID 1
let webhook2 = args.webhook_url_2 || ''; // NotifyMe UUID 2

// --- 通用配置解析 ---
let allsms = args.allsms !== undefined ? args.allsms : true;
let regexstr = args.regexstr || '码|碼|code|\\d{4,}';
let senderFilter = args.sender_filter || '';
let debugMode = args.debug_mode !== undefined ? args.debug_mode : false;
let retryCount = parseInt(args.retry_count || '1');
let timeoutSeconds = parseInt(args.timeout_seconds || '10');

if (debugMode) console.log('🐛 调试模式已开启');

// 检查发信人号码是否匹配过滤条件 (未做任何更改)
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

    // --- 原有通道 ---
    if (tgToken) {
        console.log('📤 启用 Telegram 转发');
        tasks.push(sendToTelegram(tgToken, smsData));
    }
    if (feishuToken) {
        console.log('📤 启用 飞书 转发');
        tasks.push(sendToFeishu(feishuToken, smsData));
    }
    
    // --- 新增 NotifyMe Webhook 通道 ---
    if (webhook1) {
        console.log('📤 启用 Webhook 通道 1');
        tasks.push(sendToWebhook(webhook1, smsData, 'Webhook-1'));
    }
    if (webhook2) {
        console.log('📤 启用 Webhook 通道 2');
        tasks.push(sendToWebhook(webhook2, smsData, 'Webhook-2'));
    }

    if (tasks.length === 0) {
        console.log('⚠️ 未配置任何有效的转发目标');
        if (debugMode) $notification.post('转发取消', '未配置目标', '请在插件参数中至少填写一个平台的Token或UUID');
        $done();
        return;
    }

    // 等待所有并发的转发任务完成
    await Promise.all(tasks);
    console.log('🎉 所有启用的转发任务已执行完毕');
    $done();
}

// 获取短信数据 (未做任何更改)
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
    console.log('⚠️ 使用测试数据 (通常发生在编辑器空跑或非真实请求时)');
    return { sender: '10086', message: '【测试】您的验证码是123456，请在5分钟内输入。' };
}

// --- 发送到 NotifyMe Webhook (新增) ---
function sendToWebhook(input, smsData, platformName) {
    let uuid = input.trim();
    // 固定为你提供的服务器地址
    const url = `https://notifyme-server.wzn556.top/push`;

    // 严格按照 SmsForwarder 给出的 JSON 模板封装
    const payload = {
        "data": {
            "uuid": uuid,
            "ttl": 86400,
            "priority": "high",
            "data": {
                "title": smsData.sender,     // 替换模板的 [from]
                "body": smsData.message,    // 替换模板的 [msg]
                "group": "短信",
                "bigText": true
            }
        }
    };

    // 复用原有的网络请求函数，确保重试和超时逻辑生效
    return sendHttpRequest(url, JSON.stringify(payload), platformName);
}

// --- 发送到 Telegram (支持反代链接 - 完好保留原逻辑) ---
function sendToTelegram(tgInput, smsData) {
    let url = "";
    let chatid = "";
    const input = tgInput.trim();

    if (input.startsWith('http')) {
        if (input.includes('#')) {
            const parts = input.split('#');
            url = parts[0];
            chatid = parts[1];
        } else {
            url = input;
        }
    } else {
        const lastDot = input.lastIndexOf('.');
        if (lastDot === -1) {
            console.log('❌ Telegram Token 格式错误');
            return Promise.resolve();
        }
        const bottoken = input.substring(0, lastDot).trim();
        chatid = input.substring(lastDot + 1).trim();
        url = `https://api.telegram.org/bot${bottoken}/sendMessage`;
    }

    const text = `📱 短信转发: ${smsData.message}`;
    const payload = {
        text: text,
        parse_mode: 'Markdown'
    };
    if (chatid) payload.chat_id = chatid;

    return sendHttpRequest(url, JSON.stringify(payload), 'Telegram');
}

// --- 发送到飞书机器人 (完好保留原逻辑) ---
function sendToFeishu(feishuInput, smsData) {
    let url = feishuInput.trim(); 

    if (!url.startsWith('http')) {
        url = url.replace(/^hook\//, '');
        url = `https://open.feishu.cn/open-apis/bot/v2/hook/${url}`;
    }
    url = url.replace(/[^a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]/g, '');
    
    const text = `📱 短信转发: ${smsData.message}`;
    return sendHttpRequest(url, JSON.stringify({ msg_type: 'text', content: { text: text } }), '飞书');
}

// --- 核心网络请求封装 (所有通道的基石，完好保留原逻辑) ---
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
