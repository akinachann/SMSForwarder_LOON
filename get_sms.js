// 获取TX短信转发脚本 v2.2.0
// 根据 Loon 官方文档重构
// 文档: https://nsloon.app/docs/Plugin/ 和 https://nsloon.app/docs/Script/script_api

const SCRIPT_VERSION = '2.2.0';
const SCRIPT_DATE = '2025-03-25';

console.log(`📱 短信转发脚本启动 v${SCRIPT_VERSION} (${SCRIPT_DATE})`);

// 根据官方文档，使用 $argument.参数名 获取参数
console.log('🔍 原始参数:', JSON.stringify($argument, null, 2));

// 处理通知方式的映射
function mapNotifyValue(value) {
    if (typeof value === 'string') {
        switch (value) {
            case '钉钉':
                return '0';
            case 'Server酱':
                return '1';
            case '辰星短信':
                return '2';
            case 'Telegram':
                return '3';
            case '飞书':
                return '4';
            default:
                return value;
        }
    }
    return value || '2';
}

let notify = mapNotifyValue($argument.notify);
let tokenetc = $argument.tokenetc || 'fysms.deno.dev';
let allsms = $argument.allsms !== undefined ? $argument.allsms : true;
let regexstr = $argument.regexstr || '码|碼|code|\\d{4,}';
let senderFilter = $argument.sender_filter || '';
let debugMode = $argument.debug_mode !== undefined ? $argument.debug_mode : false;
let retryCount = parseInt($argument.retry_count || '1');
let timeoutSeconds = parseInt($argument.timeout_seconds || '10');

console.log('🔧 参数获取结果:');
console.log(`🔧 - notify: "${notify}" (原值: "${$argument.notify}")`);
console.log(`🔧 - tokenetc: "${tokenetc}"`);
console.log(`🔧 - allsms: ${allsms}`);
console.log(`🔧 - regexstr: "${regexstr}"`);
console.log(`🔧 - senderFilter: "${senderFilter}"`);
console.log(`🔧 - debugMode: ${debugMode}`);
console.log(`🔧 - retryCount: ${retryCount}`);
console.log(`🔧 - timeoutSeconds: ${timeoutSeconds}`);

if (debugMode) {
    console.log('🐛 调试模式已开启');
}

// 参数验证
if (!tokenetc || tokenetc.trim() === '') {
    console.log('❌ tokenetc 参数为空');
    $notification.post('参数错误', 'tokenetc为空', '请检查插件配置');
    $done();
}

// 验证 notify 参数
if (!['0', '1', '2', '3', '4'].includes(notify)) {
    console.log('❌ notify 参数无效:', notify);
    $notification.post('配置错误', `notify=${$argument.notify}`, '请选择正确的通知方式');
    $done();
}

// 检查发信人号码是否匹配过滤条件
function checkSenderFilter(sender) {
    if (!senderFilter || senderFilter.trim() === '') {
        console.log('🔍 发信人过滤: 未设置过滤条件，允许所有发信人');
        return true;
    }

    const allowedSenders = senderFilter.split(',').map(s => s.trim()).filter(s => s !== '');
    console.log(`🔍 检查发信人过滤: "${sender}" 是否在允许列表 [${allowedSenders.join(', ')}] 中`);

    const isAllowed = allowedSenders.some(allowed => {
        return sender === allowed || sender.includes(allowed) || allowed.includes(sender);
    });

    console.log(`🔍 发信人过滤结果: ${isAllowed ? '✅ 允许转发' : '❌ 拒绝转发'}`);

    if (debugMode) {
        $notification.post('发信人过滤',
            isAllowed ? '✅ 允许转发' : '❌ 拒绝转发',
            `发信人: ${sender}\n允许列表: ${allowedSenders.join(', ')}`);
    }

    return isAllowed;
}

// 主处理函数
function main() {
    console.log('🚀 开始处理短信');

    let smsData = getSmsData();
    if (!smsData) {
        console.log('❌ 无法获取短信数据');
        $notification.post('短信转发', '错误', '无法获取短信数据');
        $done();
        return;
    }

    console.log(`📨 短信数据: 发送方=${smsData.sender}, 内容=${smsData.message}`);

    if (!checkSenderFilter(smsData.sender)) {
        console.log('❌ 发信人不在允许列表中，跳过转发');
        $done();
        return;
    }

    if (!allsms && !new RegExp(regexstr).test(smsData.message)) {
        console.log('❌ 短信不匹配规则，跳过');
        if (debugMode) {
            $notification.post('规则不匹配', '短信跳过', `内容: ${smsData.message.substring(0, 20)}...\n规则: ${regexstr}`);
        }
        $done();
        return;
    }

    console.log('✅ 短信匹配规则，准备转发');

    switch (notify) {
        case '0':
            console.log('📤 使用钉钉通知');
            sendToDingTalk(tokenetc, smsData);
            break;
        case '1':
            console.log('📤 使用Server酱通知');
            sendToServerChan(tokenetc, smsData);
            break;
        case '2':
            console.log('📤 使用辰星短信通知');
            sendToChenXing(tokenetc, smsData);
            break;
        case '3':
            console.log('📤 使用 Telegram 通知');
            sendToTelegram(tokenetc, smsData);
            break;
        case '4':
            console.log('📤 使用飞书通知');
            sendToFeishu(tokenetc, smsData);
            break;
        default:
            console.log('❌ 未知的通知方式:', notify);
            $notification.post('配置错误', '未知通知方式', `notify=${notify}`);
            $done();
    }
}

// 获取短信数据
function getSmsData() {
    if (typeof $request !== 'undefined' && $request.body) {
        console.log('📱 从 $request.body 获取数据');
        try {
            const requestData = JSON.parse($request.body);
            if (debugMode) {
                console.log('📦 请求数据:', JSON.stringify(requestData, null, 2));
                $notification.post('调试信息', '获取到真实短信数据', '来源: 腾讯手机管家请求');
            }

            if (requestData.query && requestData.query.message) {
                return {
                    sender: requestData.query.sender || '未知发送方',
                    message: requestData.query.message.text || requestData.query.message
                };
            }
        } catch (error) {
            console.log('❌ 解析 $request.body 失败:', error);
            if (debugMode) {
                $notification.post('解析错误', '请求体解析失败', error.toString());
            }
        }
    }

    console.log('⚠️ 使用测试数据');
    if (debugMode) {
        $notification.post('调试模式', '使用测试数据', '无法获取真实短信，使用模拟数据进行测试');
    }
    return {
        sender: '10086',
        message: '【测试】您的验证码是123456，请在5分钟内输入。'
    };
}

// 发送到辰星短信
function sendToChenXing(server, smsData) {
    console.log('🔧 辰星短信通知开始');

    let url;
    if (server.startsWith('http://') || server.startsWith('https://')) {
        url = server.endsWith('/sms') ? server : `${server}/sms`;
    } else {
        url = `https://${server}/sms`;
    }

    console.log(`📍 目标URL: "${url}"`);

    const codeMatch = smsData.message.match(/验证码[：:]?(\d{6})/);
    const verificationCode = codeMatch ? codeMatch[1] : '';

    const requestData = {
        sender: smsData.sender,
        message: smsData.message,
        code: verificationCode,
        timestamp: Date.now(),
        source: "loon_sms",
        version: SCRIPT_VERSION
    };

    sendHttpRequest(url, JSON.stringify(requestData));
}

// 发送到钉钉
function sendToDingTalk(config, smsData) {
    const configParts = config.split('.');
    const keyword = configParts[0].trim();
    const token = configParts[1].trim();
    const url = `https://oapi.dingtalk.com/robot/send?access_token=${token}`;

    const requestData = {
        msgtype: "text",
        text: {
            content: `${keyword}\n发送号码:${smsData.sender} 短信内容:${smsData.message}`
        }
    };

    sendHttpRequest(url, JSON.stringify(requestData));
}

// 发送到Server酱
function sendToServerChan(sendkey, smsData) {
    const url = String(sendkey).startsWith('sctp')
        ? `https://${sendkey.match(/^sctp(\d+)t/)[1]}.push.ft07.com/send/${sendkey}.send`
        : `https://sctapi.ftqq.com/${sendkey}.send`;

    const requestData = {
        title: "TX短信转发",
        desp: `发送号码:${smsData.sender} 短信内容:${smsData.message}`
    };

    sendHttpRequest(url, JSON.stringify(requestData));
}

// 发送到 Telegram
// tokenetc 格式: BotToken.ChatID
// BotToken 形如 123456789:AAFxxxxxxx，ChatID 形如 -100123456789
// 完整示例: 123456789:AAFxxxxxxx.-100123456789
// 以最后一个 . 为分隔符，前段为 BotToken，后段为 ChatID
function sendToTelegram(tokenkey, smsData) {
    console.log('🔧 Telegram 通知开始');

    const lastDot = tokenkey.lastIndexOf('.');
    const bottoken = tokenkey.substring(0, lastDot).trim();
    const chatid = tokenkey.substring(lastDot + 1).trim();

    console.log(`🤖 BotToken: ${bottoken.substring(0, 10)}...`);
    console.log(`💬 ChatID: ${chatid}`);

    const url = `https://api.telegram.org/bot${bottoken}/sendMessage`;
    const text = `📱 TX短信转发\n发送号码: ${smsData.sender}\n短信内容: ${smsData.message}`;

    const requestData = {
        chat_id: chatid,
        text: text
    };

    if (debugMode) {
        $notification.post('Telegram 通知', `目标 ChatID: ${chatid}`, `消息: ${text.substring(0, 50)}...`);
    }

    sendHttpRequest(url, JSON.stringify(requestData));
}

// 发送到飞书自定义机器人
// tokenetc 格式: 飞书 webhook 地址末尾的 hook token
// 即 https://open.feishu.cn/open-apis/bot/v2/hook/{此处} 的值
// 注意: 若飞书机器人开启了签名校验，请改用关键词校验，添加关键词"TX短信"即可
function sendToFeishu(hooktoken, smsData) {
    console.log('🔧 飞书通知开始');

    const url = `https://open.feishu.cn/open-apis/bot/v2/hook/${hooktoken}`;
    const text = `TX短信转发\n发送号码: ${smsData.sender}\n短信内容: ${smsData.message}`;

    const requestData = {
        msg_type: 'text',
        content: { text: text }
    };

    console.log(`📍 目标URL: "${url}"`);

    if (debugMode) {
        $notification.post('飞书通知', `Hook: ${hooktoken.substring(0, 8)}...`, `消息: ${text.substring(0, 50)}...`);
    }

    sendHttpRequest(url, JSON.stringify(requestData));
}

// 发送HTTP请求
function sendHttpRequest(url, body, currentRetry = 0) {
    console.log(`📡 发送网络请求 (第${currentRetry + 1}次尝试)`);
    console.log(`📍 URL: ${url}`);

    if (debugMode) {
        console.log(`📦 Body: ${body}`);
        $notification.post('网络请求', `发送中... (${currentRetry + 1}/${retryCount})`, `目标: ${url}`);
    }

    const requestConfig = {
        url: url,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': `Loon-SMS-Forwarder/${SCRIPT_VERSION}`,
            'X-Script-Version': SCRIPT_VERSION,
            'X-Script-Date': SCRIPT_DATE
        },
        body: body,
        timeout: timeoutSeconds * 1000
    };

    $httpClient.post(requestConfig, function(error, response, data) {
        console.log('📡 收到响应');

        if (error) {
            console.log('💥 请求错误:', error);

            if (debugMode) {
                $notification.post('网络错误', '请求失败', `错误: ${error.toString()}\n重试: ${currentRetry + 1}/${retryCount}`);
            }

            if (currentRetry < retryCount - 1) {
                console.log(`🔄 准备重试 (${currentRetry + 1}/${retryCount - 1})`);
                setTimeout(() => {
                    sendHttpRequest(url, body, currentRetry + 1);
                }, 2000);
                return;
            }

            $notification.post('网络请求失败', `重试${retryCount}次后仍失败`, error.toString());
            $done();
        } else {
            const statusCode = response?.status || response?.statusCode || 200;
            console.log(`✅ 请求成功，状态码: ${statusCode}`);

            if (debugMode) {
                console.log('📊 响应:', JSON.stringify(response, null, 2));
                console.log('📊 数据:', data);
                $notification.post('网络响应', `状态码: ${statusCode}`, `响应数据: ${data ? data.substring(0, 100) : '无数据'}`);
            }

            if (statusCode >= 200 && statusCode < 300) {
                $notification.post('短信转发成功', `状态码: ${statusCode}`, '验证码已发送到服务器');
            } else {
                console.log(`⚠️ 服务器响应异常，状态码: ${statusCode}`);

                if (statusCode >= 500 && currentRetry < retryCount - 1) {
                    console.log(`🔄 服务器错误，准备重试 (${currentRetry + 1}/${retryCount - 1})`);
                    setTimeout(() => {
                        sendHttpRequest(url, body, currentRetry + 1);
                    }, 3000);
                    return;
                }

                $notification.post('短信转发异常', `状态码: ${statusCode}`, '服务器响应异常');
            }

            $done();
        }
    });
}

// 启动主函数
main();
