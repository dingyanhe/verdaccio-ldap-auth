import { Logger } from '@verdaccio/types';
import {
  createClient,
  Client,
  ClientOptions,
  SearchOptions,
  SearchEntry,
} from "ldapjs";

export interface IVerifyPasswordOptions {
  /**
   * 用户dn
   */
  user: string;
  /**
   * 用户dn密码
   */
  userPwd: string;
  /**
   * 管理员dn
   */
  adminDn: string;
  /**
   * 管理员密码
   */
  adminPwd: string;
  /**
   * 搜索基础dn，一般先用管理员账号登陆，之后在这个dn下搜索user，然后找到userDn，然后再用userPwd验证密码
   */
  baseDn: string;
  /**
   * 在搜索基础dn基础上，怎家过滤条件，精确匹配目标用户
   */
  searchOptions: Omit<SearchOptions, "filter"> & {
    filter: Record<string, string>;
  };
  /**
   * 用来搜索时候替换字段用，例如filter: { mail: `{user}@163.com` }
   * 那么这里就需要filter2ReplaceKey: { mail: user } // 此处的user来自IVerifyPasswordOptions
   */
  filter2ReplaceKey: Record<string, string>;
}

export class LDAPClientPromise {
  client: Client;
  logger: Logger;

  constructor(options: ClientOptions, logger: Logger) {
    this.client = createClient(options);
    this.logger = logger
  }

  bindPromise(userDn: string, userPwd: string) {
    this.logger.info("bind userDn")
    return new Promise<void>((resolve, reject) => {
      this.client.bind(userDn, userPwd, (e) => {
        if (e) {
          this.logger.info("bind userDn 失败")
          reject(e);
          this.client.unbind();
          return;
        }
        this.logger.info("bind userDn 成功")
        resolve();
      });
    });
  }

  searchPromise(baseDn: string, searchOptions: SearchOptions) {
    this.logger.info("searchPromise...")
    return new Promise<SearchEntry[]>((resolve, reject) => {
      const finalRes: SearchEntry[] = [];
      this.client.search(baseDn, searchOptions, (er, r) => {
        if (er) {
          this.logger.info("searchPromise 失败")
          reject(er);
          this.client.unbind();
          return;
        }

        r.on("searchEntry", (entry: SearchEntry) => {
          finalRes.push(entry);
        });

        r.on("error", (rErr) => {
          this.logger.info("searchPromise response 失败")
          reject(rErr);
          this.client.unbind();
        });

        r.on("end", () => {
          this.logger.info("searchPromise 成功")
          resolve(finalRes);
        });
      });
    });
  }

  static async verifyPassword(
    c: LDAPClientPromise,
    options: IVerifyPasswordOptions
  ) {
    c.logger.info('verifyPassword...')
    const { adminDn, adminPwd, baseDn, userPwd } = options;
		try {
			await c.bindPromise(adminDn, adminPwd);
      c.logger.info('verifyPassword 成功')
		} catch (error) {
      c.logger.info('verifyPassword 管理员认证异常')
			throw new Error('管理员认证异常')
		}
		let entries: SearchEntry[]
		try {
      c.logger.info('verifyPassword searchPromise target...')
			entries = await c.searchPromise(
				baseDn,
				convertVerifyPwdOptions2SearchOptions(options)
			);
      c.logger.info('verifyPassword searchPromise target 成功')
		} catch (error) {
      c.logger.info('verifyPassword searchPromise target 异常')
			throw new Error('搜索异常')
		}

    const [{ objectName: userDn = '' } = {}] = entries || [] 
    if (!userDn) {
      c.logger.info('verifyPassword bindPromise check 查询不到用户')
      throw new Error('找不到用户')
    }

		try {
      c.logger.info('verifyPassword bindPromise 验证用户名密码...')
			await c.bindPromise(userDn?.toString() ?? '', userPwd)
      c.logger.info('verifyPassword bindPromise 验证用户名密码 成功')
		} catch (error) {
      c.logger.info('verifyPassword bindPromise 验证用户名密码 失败')
			throw new Error('用户认证异常')
		}
  }
}

/**
 * 在verdaccio配置文件里配置 filterStrings: 'mail={user}@163.com'
 * 用户输入用户名密码：user1 pwd1
 * 在搜索的时候会被替换'mail=user1@163.com'，搜索出来用户dn，然后验证密码
 * @returns 
 */
function convertVerifyPwdOptions2SearchOptions(
  o: IVerifyPasswordOptions
): SearchOptions {
  const { searchOptions, filter2ReplaceKey } = o || {};
  const { filter, ...otherSearhOptions } = searchOptions || {};
  const filterStrings = Object.entries(filter).map(([k, v]) => {
    const objectKeys = Object.keys(filter2ReplaceKey || {});
    const newVal = objectKeys.reduce((t, aliasKey) => {
      const replaceValue = o?.[filter2ReplaceKey?.[aliasKey]];
      if (!replaceValue) {
        throw new Error(`convertVerifyPwdOptions2SearchOptions 转换数据异常 ${aliasKey}=${replaceValue}`)
      }
      return t.replace(`{${aliasKey}}`, replaceValue);
    }, v);
    return `(${k}=${newVal})`;
  });
  return {
    scope: "sub",
    filter:
      filterStrings.length > 1
        ? `(&${filterStrings.join("")})`
        : filterStrings.join(""),
    ...otherSearhOptions,
  };
}
