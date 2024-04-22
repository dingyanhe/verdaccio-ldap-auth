# 自定义verdaccio的sso授权

注意：这里使用的pnpm的overrides配置，才能正常构建

## 使用

```bash
pnpm add verdaccio-auth
```

在配置文件里这样配置

```yaml
# ...
auth:
  auth:
    clientOptions:
      url: ldap://xxxxx:389 # 请求的url
    verifyPasswordOptions:
      adminDn: CN=npm服务,DC=100me,DC=com
      adminPwd: xxxx
      baseDn: DC=example,DC=com
      searchOptions:
        filter:
          mail: "{user}@example.me" # mail是ldap字段名，user是登陆的用户名
      filter2ReplaceKey: # 用来声明，用请求的user字段填充填searchOptions的filter
        user: user
# ...
```

## 遇到中文识别不了的问题

可以尝试使用如下包进行覆盖

```js
  "pnpm": {
    "overrides": {
      "@ldapjs/dn": "npm:ldapjs-dn-fork@1.1.0"
    }
  }
```
