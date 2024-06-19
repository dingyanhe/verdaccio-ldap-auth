import { Logger } from '@verdaccio/types';
import {
  createClient,
  Client,
  ClientOptions,
  SearchOptions,
  SearchEntry,
} from "ldapjs";
import { timeout2Throw } from './timeout'

export interface IOptions extends ClientOptions {
  /**
   * 绑定dn超时时间
   */
  dnTimeout?: number
  /**
   * 搜索dn超时时间
   */
  searchTimeout?: number
  /**
   * dn最大可重复次数，防止搜出来过多，导致验证丢失状态
   */
  dnRepeatLimit?: number,
  /**
   * 每个dn验证超时时间
   */
  perVerfiryDnTimeout?: number,
}

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

  options: IOptions

  constructor(options: IOptions, logger: Logger) {
    this.client = createClient(options);
    this.options = {
      dnTimeout: 3e3,
      searchTimeout: 3e3,
      dnRepeatLimit: 100,
      perVerfiryDnTimeout: 3e3,
      ...(options ?? {})
    }
    this.logger = logger
  }

  bindPromise(userDn: string, userPwd: string) {
    this.logger.info("bind userDn")
    return Promise.race([
      timeout2Throw(this.options.dnTimeout, 'bind userDn 超时失败'),
      new Promise<void>((resolve, reject) => {
        this.client.bind(userDn, userPwd, (e) => {
          if (e) {
            this.logger.info("bind userDn 失败")
            reject(e);
            return;
          }
          this.logger.info("bind userDn 成功")
          resolve();
        });
      })
    ]);
  }

  searchPromise(baseDn: string, searchOptions: SearchOptions) {
    this.logger.info("searchPromise...")
    return Promise.race([
      timeout2Throw(this.options.searchTimeout, 'searchPromise 超时失败'),
      new Promise<SearchEntry[]>((resolve, reject) => {
        const finalRes: SearchEntry[] = [];
        this.client.search(baseDn, searchOptions, (er, r) => {
          if (er) {
            this.logger.info("searchPromise 失败")
            reject(er);
            return;
          }

          r.on("searchEntry", (entry: SearchEntry) => {
            finalRes.push(entry);
          });

          r.on("error", (rErr) => {
            this.logger.info("searchPromise response 失败")
            reject(rErr);
          });

          r.on("end", () => {
            this.logger.info("searchPromise 成功")
            resolve(finalRes);
          });
        });
      })
    ])
  }

  unbindPromise() {
    return new Promise<void>((resolve, reject) => {
      this.client?.unbind?.(e => {
        e ? reject(e) : resolve()
      })
    })
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
			) as SearchEntry[];
      c.logger.info('verifyPassword searchPromise target 成功')
		} catch (error) {
      c.logger.info('verifyPassword searchPromise target 异常')
			throw new Error('搜索异常')
		}

    const dns = (entries || [] )?.map?.(e => e?.objectName?.toString())?.filter(e => !!e) as string[]
    if (!dns || !dns?.length) {
      c.logger.info('verifyPassword verifyEntriesPwd check 查询不到用户')
      throw new Error('找不到用户')
    }

		try {
      c.logger.info('verifyPassword verifyEntriesPwd 验证用户名密码...')
      await verifyEntriesPwd(c, dns, userPwd)
      c.logger.info('verifyPassword verifyEntriesPwd 验证用户名密码 成功')
		} catch (error) {
      c.logger.info('verifyPassword verifyEntriesPwd 验证用户名密码 失败')
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

/**
 * 搜索出来配置用户dn后需要逐条验证密码，要是有通过的就通过
 */
async function verifyEntryPwd(c: LDAPClientPromise, userDn: string, userPwd: string) {
  if (typeof userDn !== 'string' || !userDn) {
    c.logger.info('verifyEntryPwd 参数入参失败userDn无效')
    return false
  }

  try {
    c.logger.info('verifyEntryPwd bindPromise 验证用户名密码...')
    await Promise.race([
      timeout2Throw(c.options?.perVerfiryDnTimeout || 3e3, '验证超时'),
      c.bindPromise(userDn?.toString() ?? '', userPwd),
    ]) 
    c.logger.info('verifyEntryPwd bindPromise 验证用户名密码 成功')
    return true
  } catch (error) {
    c.logger.info('verifyEntryPwd bindPromise 验证用户名密码 失败')
    return false
  }
}

/**
 * 搜索出来配置用户dn后需要逐条验证密码，要是有通过的就通过
 */
async function verifyEntriesPwd(c: LDAPClientPromise, dns: string[], userPwd: string) {
  dns = dns.filter(e => !!e)
  if (!dns.length) {
    c.logger.error('verifyEntriesPwd 无效的dn列表')
    return 
  }

  // 一个接口算100ms，最多100次验证重复，估摸最久等待10s
  let maxSameLdapAccountLimit = c.options.dnRepeatLimit!
  //选择一个个验证
  while(dns.length && maxSameLdapAccountLimit > 0) {
    const userDn = dns.pop() as string
    maxSameLdapAccountLimit--
    const flag = await verifyEntryPwd(c, userDn, userPwd)
    // 主要有一个验证通过就通过
    if (flag) {
      c.logger.info('verifyEntriesPwd done 找到符合密码的用户')
      return true
    }
  }

  c.logger.info('verifyEntriesPwd done 未找到符合密码的用户')
  throw new Error('用户认证异常')
}
