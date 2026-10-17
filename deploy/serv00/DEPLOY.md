# 掌心窗公开版 — Serv00 免费主机部署指南（零基础版）

> 适用版本：v0.3.8.8 · 分支：`render-unified` · 全程免信用卡、永久免费
> 部署架构：一个 Serv00 账号里跑 3 个进程（Python 后端 + Node MCP + 反向代理），对外只开 1 个端口。

---

## 一、第一阶段：注册 Serv00（约 5 分钟）

1. 打开官网 <https://serv00.com>，点 **Create account**（不要挂 VPN，用干净网络）。
2. 邮箱**建议用 Gmail 或 Outlook**（QQ/163 邮箱有时收不到或被拦截）。
3. 注册成功后收欢迎邮件，抄下四样东西：
   - **Login**（你的用户名，例如 `zhangsan`）
   - 登录密码
   - **DevilWEB 面板网址**
   - **SSH/SFTP 服务器地址**（例如 `s15.serv00.com`）

## 二、第二阶段：DevilWEB 面板三件套（必做，约 3 分钟）

登录 DevilWEB 面板（右上角可切换中文/English）：

1. **开放执行权限**
   左侧 **Additional services（附加服务）→ Run your own applications（运行你自己的应用）→ Enable**。
   ⚠️ 不开这项，你自己目录里的文件无法加可执行权限，后面全卡住。

2. **预留对外端口**
   左侧 **Port reservation（端口预留）→ Add port**：
   - Port：点 **Random** 随机一个（或手填一个 5 位数，例如 `52831`）
   - Type：选 **TCP**
   - Description：随便填，例如 `linjian`
   - 保存后**记下这个端口号**（下文称「你的端口」）。
   免费额度共 3 个 TCP 端口，我们只用 1 个；另外两个内部端口走本机回环，不占额度。

3. **记下你的域名**
   左侧 **WWW Websites** 里能看到你的免费域名，形如 `<用户名>.serv00.net`。

## 三、第三阶段：SSH 部署（复制粘贴，约 5 分钟）

Windows 无需安装任何软件：按 `Win + S` 搜 **PowerShell** 打开，输入（替换成你的用户名和服务器地址）：

```powershell
ssh 你的用户名@s15.serv00.com
```

密码输入时不显示任何字符，这是正常的，输完按回车。

登录成功后，**逐段**粘贴以下命令（每段等它跑完再贴下一段）：

```bash
# 第 1 段：拉取代码（约 10 秒）
git clone -b render-unified https://github.com/meng21336/linjian-peek-public.git ~/linjian
cd ~/linjian

# 第 2 段：安装依赖（约 1-2 分钟）
npm install --omit=dev --prefix mcp

# 第 3 段：确认运行环境（应显示 node v20+/v22+、python 3.x）
node -v; python3 -v
```

> 如果 `node -v` 报错找不到命令，试 `node22 -v` 或 `node20 -v`；若只有带版本号的命令，把第 5 段里的 `pm2 start ...` 改成对应的绝对路径启动（见文末排障）。

```bash
# 第 4 段：安装 PM2 进程守护（约 30 秒）
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
export PATH=~/.npm-global/bin:$PATH
npm install -g pm2

# 第 5 段：启动三个进程（把 52831 换成「你的端口」）
export PROXY_PORT=52831
pm2 start deploy/serv00/ecosystem.config.js
pm2 save

# 第 6 段：设置自动拉起（服务器重启后 10 分钟内自动恢复）
PM2=~/.npm-global/bin/pm2
(crontab -l 2>/dev/null; echo "@reboot $PM2 resurrect >/dev/null 2>&1"; echo "*/10 * * * * $PM2 resurrect >/dev/null 2>&1") | crontab -

# 第 7 段：查看状态（三个都应是 online，按 q 退出）
pm2 status
```

## 四、第四阶段：验证服务（2 分钟）

在你**自己电脑的浏览器**里打开（替换用户名和端口）：

| 检查项 | 地址 | 期望结果 |
|---|---|---|
| 后端健康检查 | `http://<用户名>.serv00.net:<你的端口>/health` | 返回 JSON（含 ok: true） |
| MCP 健康检查 | `http://<用户名>.serv00.net:<你的端口>/mcp-health` | 返回 MCP 状态 JSON |
| 根路由 | `http://<用户名>.serv00.net:<你的端口>/` | 返回服务信息 |

三个都通 = 部署成功。记下这个地址，例如：
`http://zhangsan.serv00.net:52831`

## 五、第五阶段：手机端配置（掌心窗 / 小手机）

| 配置项 | 填什么 |
|---|---|
| 服务器地址 | `http://<用户名>.serv00.net:<你的端口>` |
| 访问令牌 / Token | `3529388919` |
| 设备 ID | `android-phone` |
| MCP 端点（如 App 要求填完整路径） | `<上面的地址>/mcp`（或 `/sse`） |

> Android 端「掌心窗」App 一般只需要填服务器地址 + Token，上传入口为 `<地址>/api/latest`，由 App 自动拼接。

## 六、可选：升级 HTTPS 干净地址（去掉端口号）

默认地址带端口号且是 http。想要 `https://<用户名>.serv00.net/` 这样干净的地址：

1. DevilWEB → **WWW Websites → Add new website**：
   - Domain 填你的 `<用户名>.serv00.net`
   - Website type 选 **Node.js**
   - Node.js binary 选 **22**（或 20）
   - Environment 选 **Production**，勾选 **DNS support**
2. **Manage SSL → 签发 Let's Encrypt 证书**。
3. SSH 执行：
   ```bash
   mkdir -p ~/domains/<用户名>.serv00.net/public_nodejs
   cp ~/linjian/proxy.js ~/domains/<用户名>.serv00.net/public_nodejs/app.js
   echo '{"type":"module"}' > ~/domains/<用户名>.serv00.net/public_nodejs/package.json
   ```
4. PM2 里的三个进程保持运行即可（Passenger 会动态分配端口给 app.js，两者互不冲突）。
5. 等 1-2 分钟访问 `https://<用户名>.serv00.net/health` 验证。

## 七、长期使用注意事项

1. **每 3 个月至少登录一次**面板或 SSH，否则账号会被回收。建议在手机日历设个季度提醒。
2. **内存上限 512MB**：`pm2 status` 里看 RESTART 次数和内存，异常时 `pm2 restart all`。
3. **服务器偶发重启**：已配 cron 自动拉起，最迟 10 分钟恢复。
4. **数据位置**：截图和状态文件在 `~/linjian-data/`，重装代码不会丢。
5. **更新版本**：以后仓库更新后，SSH 执行 `cd ~/linjian && git pull && pm2 restart all`。
6. **排障**：`pm2 logs linjian-proxy --lines 30` 看代理日志；`pm2 logs linjian-backend --lines 30` 看后端日志。

## 八、常见报错速查

| 现象 | 原因 | 解决 |
|---|---|---|
| 页面打不开、连接超时 | 端口没填对 / 端口没预留 | 检查地址里的端口 = Port reservation 里的端口 |
| `pm2: command not found` | 环境变量没生效 | 执行 `export PATH=~/.npm-global/bin:$PATH`，或退出 SSH 重登 |
| 后端 `BAD_TOKEN` | Token 不一致 | 确认 ecosystem 里 TOKEN 与手机端一致（3529388919） |
| `listen failed: EADDRINUSE` | 该端口本机被占 | 换一个预留端口，`PROXY_PORT=新端口 pm2 restart linjian-proxy` |
| 进程反复重启 | 内存超 512MB 被杀 | `pm2 restart all`，减少同时打开的工具调用 |
