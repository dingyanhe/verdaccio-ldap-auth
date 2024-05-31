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
      adminDn: CN=npm服务,DC=163,DC=com
      adminPwd: xxxx
      baseDn: DC=163,DC=com
      searchOptions:
        filter:
          mail: "{user}@163.me" # mail是ldap字段名，user是登陆的用户名
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

## 遇到node14版本识别不了

```js
require("node:util") # 此处构建babel和rollup都不管
```

```json
  "pnpm": {
    "overrides": {
      "process-warning": "~2.2.0"
    }
  }
```

更多问题文档 [make emit work in jest](https://github.com/fastify/process-warning/commit/4835bb01cf9ddaa24678f824520b50f1e566ac0d)

## babel没有注入replaceAll

需要运行在node v14.17 环境下，该环境下一直没有 replaceAll方法，babel也未注入，需要手动引入

```js
import 'core-js/modules/es.string.replace-all'
```
