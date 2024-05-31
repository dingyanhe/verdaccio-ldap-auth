// import 'core-js/modules/es.string.replace-all'
import {
  PluginOptions,
  AuthAccessCallback,
  AuthCallback,
  PackageAccess,
  IPluginAuth,
  RemoteUser,
  Logger,
} from "@verdaccio/types";

import { PluginAuthConfig } from "../types/index";
import {
  getForbidden,
  getInternalError,
  getUnauthorized,
} from "@verdaccio/commons-api";
import { LDAPClientPromise } from './utils/ldapLogin';

/**
 * 自定义Verdaccio授权插件
 */
export default class AuthCustomPlugin implements IPluginAuth<PluginAuthConfig> {
  public logger: Logger;
  private config: PluginAuthConfig;

  public constructor(
    config: PluginAuthConfig,
    options: PluginOptions<PluginAuthConfig>
  ) {
    this.logger = options?.logger || console;
    this.config = config;
    return this
  }

  /**
   * 验证用户
   * @param user 用户名
   * @param password 密码
   * @param cb 回调函数
   */
  public async authenticate(user: string, password: string, cb: AuthCallback) {
    try {
      const client = new LDAPClientPromise(this.config.clientOptions, this.logger)
      await LDAPClientPromise.verifyPassword(client, {
        ...this.config.verifyPasswordOptions,
        user, 
        userPwd: password,
      })
      cb(null, [user]);
    } catch (error) {
      this.logger.error({ name: user }, "@{name} 授权失败");
      // FIXME: 拦截内部错误
      cb(getInternalError((error as any).message), false);
      return;
    }
  }

  private allow_action(
    action: 'access' | 'publish' | 'unpublish',
    user: RemoteUser,
    pkg: PackageAccess,
    cb: AuthAccessCallback
  ) {
    this.logger.trace(
      { remote: user.name, action },
      `[auth/allow_action]: user: @{action} @{remote}`
    );
    const { groups, name } = user;
    const groupAccess = pkg[action] as string[];
    const hasPermission = groupAccess.some((group) => {
      return name === group || groups.includes(group);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pkgName = (pkg as any).name;
    this.logger.trace(
      { pkgName: pkgName, hasPermission, remote: user.name, groupAccess },
      `[auth/allow_action]: hasPermission? @{hasPermission} for user: @{remote}, package: @{pkgName}`
    );
    if (hasPermission) {
      cb(null, true);
      return;
    }
    if (name) {
      cb(
        getForbidden(
          `Forbidden, 不允许用户${name}对${pkgName}进行${action}操作`
        ),
        hasPermission
      );
    } else {
      cb(
        getUnauthorized(
          `Unauthorized，不允许用户${name}对${pkgName}进行${action}操作`
        ),
        hasPermission
      );
    }
  }

  /**
   * 每次访问包时触发
   * 
   * 这个工具可以交给默认的配置
   * @param user 用户分组信息
   * @param pkg 配置分组信息
   * @param cb 回调
   */
  public allow_access(
    user: RemoteUser,
    pkg: PackageAccess,
    cb: AuthAccessCallback
  ): void {
    return this.allow_action("access", user, pkg, cb);
  }

  /**
   * 每次发布时触发
   * @param user 用户分组信息
   * @param pkg 配置分组信息
   * @param cb 回调
   */
  public allow_publish(user: RemoteUser, pkg: PackageAccess, cb: AuthAccessCallback): void {
    return this.allow_action("publish", user, pkg, cb);
  }

  public adduser(user: string, password: string, cb: any): void {
    cb(null, true)
  }

  /**
   * 每次取消发布时触发
   * @param user 用户分组信息
   * @param pkg 配置分组信息
   * @param cb 回调
   */
  public allow_unpublish(user: RemoteUser, pkg: PackageAccess, cb: AuthAccessCallback): void {
    return this.allow_action("unpublish", user, pkg, cb);
  }
}
