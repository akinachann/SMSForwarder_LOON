// 获取腾讯手机管家短信转发脚本 v2.6.4
// 作者: akinachan

const SCRIPT_VERSION = '2.6.4';

console.log(`🚀 短信转发脚本启动 v${SCRIPT_VERSION}`);

const args = typeof $argument !== 'undefined' ? $argument : {};

// 独立配置
let tgToken = args.tg_token || '';
let feishuToken = args.feishu_token || '';
let webhook1 = args.webhook_url_1 || '';
let webhook2 = args.webhook_url_2 || '';

// 通用配置
let allsms = args.allsms !== undefined ? args.allsms : true;
let regexstr = args.regexstr || '码|碼|code|\\d{4,}';
let senderFilter = args.sender_filter || '';
let debugMode = args.debug_mode !== undefined ? args.debug_mode : false;
let retryCount = parseInt(args.retry_count || '1');
let timeoutSeconds = parseInt(args.timeout_seconds || '10');

if (debugMode) console.log('🐛 调试模式已开启');

// 检查发信人过滤
function checkSenderFilter(sender) {
    if (!senderFilter || senderFilter.trim() === '') return true;
    const allowedSenders = senderFilter.split(',').map(s => s.trim()).filter(s => s !== '');
    return allowedSenders.some(allowed => sender === allowed || sender.includes(allowed) || allowed.includes(sender));
}

// 主函数
async function main() {
    let smsData = getSmsData();
    if (!smsData) {
        console.log('❌ 未获取到有效短信数据，脚本结束。');
        return $done();
    }
    
    if (!checkSenderFilter(smsData.sender)) {
        console.log(`拦截: 发信人 [${smsData.sender}] 不在允许列表中。`);
        return $done();
    }
    if (!allsms && !new RegExp(regexstr).test(smsData.message)) {
        console.log('拦截: 短信内容不包含验证码关键字。');
        return $done();
    }

    console.log(`✅ 准备转发短信，发信人: [${smsData.sender}]`);
    let tasks = [];

    if (tgToken) {
        console.log('📤 准备发送至: Telegram...');
        tasks.push(sendToTelegram(tgToken, smsData));
    }
    if (feishuToken) {
        console.log('📤 准备发送至: 飞书...');
        tasks.push(sendToFeishu(feishuToken, smsData));
    }
    if (webhook1) {
        console.log('📤 准备发送至: Webhook 通道 1...');
        tasks.push(sendToWebhook(webhook1, smsData, 'Webhook-1'));
    }
    if (webhook2) {
        console.log('📤 准备发送至: Webhook 通道 2...');
        tasks.push(sendToWebhook(webhook2, smsData, 'Webhook-2'));
    }

    if (tasks.length === 0) {
        console.log('⚠️ 未配置任何转发目标 Token 或 UUID。');
        if (debugMode) $notification.post('转发取消', '未配置目标', '请在插件中配置参数');
        return $done();
    }

    await Promise.all(tasks);
    console.log('🎉 所有启用的通道任务已执行完毕！');
    $done();
}

// 获取短信数据
function getSmsData() {
    if (typeof $request !== 'undefined' && $request.body) {
        try {
            const requestData = JSON.parse($request.body);
            if (requestData.query && requestData.query.message) {
                return {
                    sender: requestData.query.sender || '未知',
                    message: requestData.query.message.text || requestData.query.message
                };
            }
        } catch (error) {
            console.log('❌ JSON 解析失败:', error);
        }
    }
    console.log('⚠️ 当前为测试模式或空请求');
    return { sender: '测试发信人', message: '【测试】您的验证码是123456。' };
}

// Webhook 通道 (NotifyMe)
function sendToWebhook(input, smsData, platformName) {
    const url = `https://notifyme-server.wzn556.top/push`;
    const payload = {
        "data": {
            "uuid": input.trim(),
            "ttl": 86400,
            "priority": "high",
            "data": {
                "title": smsData.sender,
                "body": smsData.message,
                "group": "🍎🎈 短信转发",
                "bigText": true
            }
        }
    };
    return sendHttpRequest(url, JSON.stringify(payload), platformName);
}

// Telegram 通道
function sendToTelegram(tgInput, smsData) {
    let url = "", chatid = "";
    const input = tgInput.trim();

    if (input.startsWith('http')) {
        if (input.includes('#')) {
            const parts = input.split('#');
            url = parts[0]; chatid = parts[1];
        } else url = input;
    } else {
        const lastDot = input.lastIndexOf('.');
        if (lastDot === -1) return Promise.resolve();
        const bottoken = input.substring(0, lastDot).trim();
        chatid = input.substring(lastDot + 1).trim();
        url = `https://api.telegram.org/bot${bottoken}/sendMessage`;
    }

    const payload = { text: `🍎🎈 短信转发: ${smsData.message}`, parse_mode: 'Markdown' };
    if (chatid) payload.chat_id = chatid;

    return sendHttpRequest(url, JSON.stringify(payload), 'Telegram');
}

// 飞书 通道
function sendToFeishu(feishuInput, smsData) {
    let url = feishuInput.trim(); 
    if (!url.startsWith('http')) url = `https://open.feishu.cn/open-apis/bot/v2/hook/${url.replace(/^hook\//, '')}`;
    
    const payload = { msg_type: 'text', content: { text: `🍎🎈 短信转发: ${smsData.message}` } };
    return sendHttpRequest(url, JSON.stringify(payload), '飞书');
}

// 核心网络请求 (带完整日志)
function sendHttpRequest(url, body, platformName, currentRetry = 0) {
    return new Promise((resolve) => {
        const requestConfig = {
            url: url,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': `Loon-SMS-Forwarder/${SCRIPT_VERSION}` },
            body: body,
            timeout: timeoutSeconds * 1000
        };

        $httpClient.post(requestConfig, function(error, response, data) {
            if (error) {
                console.log(`💥 [${platformName}] 请求失败:`, error);
                if (currentRetry < retryCount - 1) {
                    console.log(`🔄 [${platformName}] 准备重试 (${currentRetry + 1}/${retryCount - 1})...`);
                    setTimeout(() => resolve(sendHttpRequest(url, body, platformName, currentRetry + 1)), 2000);
                } else {
                    console.log(`❌ [${platformName}] 最终重试失败。`);
                    if (debugMode) $notification.post(`${platformName} 转发失败`, '', String(error));
                    resolve(false);
                }
            } else {
                const statusCode = response?.status || response?.statusCode || 200;
                if (statusCode >= 200 && statusCode < 300) {
                    console.log(`✅ [${platformName}] 推送成功！`);
                    resolve(true);
                } else {
                    console.log(`⚠️ [${platformName}] 推送异常，状态码: ${statusCode}`);
                    resolve(false);
                }
            }
        });
    });
}

main();
