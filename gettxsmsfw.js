let notify, tokenkey, allsms = true, regexstr = '码|碼|code|\\d{4,}'; //正则匹配转发特定的短信,可以按需修改正则,需要转义
try {
    if (typeof $argument == 'string') { //token/key等使用传入参数,代码无需写死,更加灵活
        const notifyl = $argument.split('||');
        notify = notifyl[0].trim();
        tokenkey = notifyl[1].trim();
    } else {
        switch ($argument.notify) {
            case '钉钉':
                notify = '0';
                break;
            case 'Server酱':
                notify = '1';
                break;
            case '企业微信':
                notify = '2';
                break;
            case 'Telegram':
                notify = '3';
                break;
            case '飞书':
                notify = '4';
                break;
            default:
                notify = '-1';
        }
        tokenkey = $argument.tokenkey;
        allsms = $argument.allsms;
        regexstr = $argument.regexstr;
    }
} catch {
    $notification.post($script.name, '', '参数不正确,停止运行');
}

if (tokenkey) {
    main();
}

$done();

function main() {
    let txreqbody = '',
        forward = true;
    try {
        txreqbody = $request.body;
    } catch {
        txreqbody = '{"test":"code"}';
    }
    const smso = JSON.parse(txreqbody);
    const smsender = smso?.query?.sender ?? '获取发送号码失败';
    const sms = smso?.query?.message?.text ?? '获取TX转发短信失败';
    if (!allsms) {
        forward = new RegExp(regexstr, 'i').test(sms);
    }

    if (forward) {
        switch (notify) {
            case '0':
                dtnotification(tokenkey, [smsender, sms]);
                break;
            case '1':
                scnotification(tokenkey, [smsender, sms]);
                break;
            case '2':
                wxnotification(tokenkey, [smsender, sms]);
                break;
            case '3':
                tgnotification(tokenkey, [smsender, sms]);
                break;
            case '4':
                feishunotification(tokenkey, [smsender, sms]);
                break;
            default:
                $notification.post($script.name, '', '参数不正确,停止运行');
        }
    }
}

function postmsg(requrl, reqbody) {
    const reqparams = {
        url: requrl,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: reqbody,
        timeout: 5000
    }
    $httpClient.post(reqparams);
}

function dtnotification(kwactk, smsender) {
    const kwactkl = kwactk.split('.');
    const dtactk = kwactkl[1].trim();
    const dtkeyword = kwactkl[0].trim();
    const dtwebhookurl = 'https://oapi.dingtalk.com/robot/send?access_token=' + dtactk;
    const reqbody = `{"msgtype":"text","text":{"content":"${dtkeyword}\n发送号码:${smsender[0]} 短信内容:${smsender[1]}"}}`;
    postmsg(dtwebhookurl, reqbody);
}

function scnotification(sendkey, smsender) {
    const serverchanurl = String(sendkey).startsWith('sctp')
        ? `https://${sendkey.match(/^sctp(\d+)t/)[1]}.push.ft07.com/send/${sendkey}.send`
        : `https://sctapi.ftqq.com/${sendkey}.send`;
    const reqbody = `{"title":"TX短信转发","desp":"发送号码:${smsender[0]} 短信内容:${smsender[1]}"}`;
    postmsg(serverchanurl, reqbody);
}

function wxnotification(sendkey, smsender) {
    const wxwebhookurl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=' + sendkey;
    const reqbody = `{"msgtype":"text","text":{"content":"发送号码:${smsender[0]} 短信内容:${smsender[1]}"}}`
    postmsg(wxwebhookurl, reqbody);
}

// Telegram Bot API
// tokenkey 格式: BotToken.ChatID
// BotToken 形如 123456789:AAFxxxxxxx,ChatID 形如 -100123456789
// 完整填写示例: 123456789:AAFxxxxxxx.-100123456789
// 脚本以最后一个 . 为分隔,前段为 BotToken,后段为 ChatID
function tgnotification(tokenkey, smsender) {
    const lastDot = tokenkey.lastIndexOf('.');
    const bottoken = tokenkey.substring(0, lastDot).trim();
    const chatid = tokenkey.substring(lastDot + 1).trim();
    const tgurl = `https://api.telegram.org/bot${bottoken}/sendMessage`;
    const text = `📱 TX短信转发\n发送号码: ${smsender[0]}\n短信内容: ${smsender[1]}`;
    const reqbody = JSON.stringify({ chat_id: chatid, text: text });
    postmsg(tgurl, reqbody);
}

// 飞书自定义机器人 Webhook
// tokenkey 格式: 填写 webhook 地址末尾的 hook token
// 即 https://open.feishu.cn/open-apis/bot/v2/hook/{此处} 的值
// 注意: 若飞书机器人开启了签名校验,请改用关键词校验,在消息关键词中加入"TX短信"即可
function feishunotification(hooktoken, smsender) {
    const feishuurl = `https://open.feishu.cn/open-apis/bot/v2/hook/${hooktoken}`;
    const text = `TX短信转发\n发送号码: ${smsender[0]}\n短信内容: ${smsender[1]}`;
    const reqbody = JSON.stringify({ msg_type: 'text', content: { text: text } });
    postmsg(feishuurl, reqbody);
}
