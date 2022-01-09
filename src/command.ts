import Utils from './lib/utils';
import PWL from './lib/pwl';
import * as vscode from 'vscode';

class Command
{
    info: any;
    token: string = '';
    pwl: PWL;
    webviews: Array<vscode.Webview> = [];
    context: vscode.ExtensionContext;
    timer: NodeJS.Timer|undefined;
    userBar: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    account: Account = { username: '', passwd: ''};
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.pwl = new PWL(this.context.globalState.get('token') || '');
        this.account.username = this.context.globalState.get('username') || '';
        this.account.passwd = this.context.globalState.get('passwd') || '';
    }

    // 开放给用户呼叫的 Command 函数名
    static get commands() {
        return [
            'login',
            'logout',
            'register',
            'textMode',
            'richMode'
        ];
    }

    async init() {
        this.info = (await this.pwl.info()).data;
        if (this.info) {
            this.userBar.tooltip = '点击退出登录';
            this.userBar.text = `摸鱼派: ${this.info.userNickname || this.info.userName}`;
            this.userBar.command = `pwl-chat.logout`;
        }
    }

    appendWebview(webview:vscode.Webview) {
        this.webviews?.push(webview);
    }

    register() {
        Utils.openUrl('https://fishpi.cn/register?r=imlinhanchao');
    }

    getConfig() {
        return Utils.getConfig();
    }

    textMode() {
        vscode.workspace.getConfiguration().update('pwl-chat.viewType', '文字模式');
    }
    
    richMode() {
        vscode.workspace.getConfiguration().update('pwl-chat.viewType', '图文模式');
    }
    
    async logout() {
        this.context.globalState.update('token', '');
        this.context.globalState.update('username', '');
        this.context.globalState.update('passwd', '');
        this.pwl.token = '';
        this.webviews?.forEach(w => w.postMessage({ type: 'notice', cmd: 'logout'}));
        this.userBar?.hide();			
    }

    async login() {
        try {
            let username = await Utils.prompt('用户名', this.account.username) || '';
            if (username === '') { return; }
            let passwd = await Utils.prompt('密码', this.account.passwd || '', true) || '';
            if (passwd === '') { return; }

            let data = (await this.pwl.login({ username, passwd }));
            if (data.code !== 0) {
                throw new Error(data.msg);
            }
            
            this.account = { username, passwd };
            this.context.globalState.update('username', username);
            this.context.globalState.update('passwd', passwd);

            this.token = data.Key;
            this.context.globalState.update('token', this.token);
            this.info = await this.pwl.info();
            this.webviews?.forEach(w => w.postMessage({ type: 'notice', cmd: 'login', data: this.info }));
            this.info = this.info.data;
            
            this.userBar.tooltip = '点击退出登录';
            this.userBar.text = `摸鱼派: ${this.info.userNickname}`;
            this.userBar.command = `pwl-chat.logout`;
            
            this.liveness(this.account);

            return this.info;
        } catch (e) {
            vscode.window.showErrorMessage(`登录失败：${(e as Error).message}`);
        }
    }

    liveness(account: Account) {
        if (this.timer) { clearInterval(this.timer); }
        this.timer = setInterval(async () => {
            let liveness = await this.pwl.liveness();
            if (liveness.code === 401) { this.pwl.login(account); }
            else { this.userBar.text = `摸鱼派: ${this.info?.userNickname}(${liveness}%)`; }
        }, 30000);

        this.userBar.show();
    }

    openLink(url:string) {
        Utils.openUrl(url);
    }
}

export default Command;