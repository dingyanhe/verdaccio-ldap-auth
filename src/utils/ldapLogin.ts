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

  constructor(options: ClientOptions) {
    this.client = createClient(options);
  }

  bindPromise(userDn: string, userPwd: string) {
    return new Promise<void>((resolve, reject) => {
      this.client.bind(userDn, userPwd, (e) => {
        if (e) {
          reject(e);
          this.client.unbind();
          return;
        }
        resolve();
      });
    });
  }

  searchPromise(baseDn: string, searchOptions: SearchOptions) {
    return new Promise<SearchEntry[]>((resolve, reject) => {
      const finalRes: SearchEntry[] = [];
      this.client.search(baseDn, searchOptions, (er, r) => {
        if (er) {
          reject(er);
          this.client.unbind();
          return;
        }

        r.on("searchEntry", (entry: SearchEntry) => {
          finalRes.push(entry);
        });

        r.on("error", (rErr) => {
          reject(rErr);
          this.client.unbind();
        });

        r.on("end", () => {
          resolve(finalRes);
        });
      });
    });
  }

  static async verifyPassword(
    c: LDAPClientPromise,
    options: IVerifyPasswordOptions
  ) {
    const { adminDn, adminPwd, baseDn, userPwd } = options;
		try {
			await c.bindPromise(adminDn, adminPwd);
		} catch (error) {
			throw new Error('管理员认证异常')
		}
		let entries: SearchEntry[]
		try {
			entries = await c.searchPromise(
				baseDn,
				convertVerifyPwdOptions2SearchOptions(options)
			);
		} catch (error) {
			throw new Error('搜索异常')
		}

		try {
			const [{ objectName: userDn = '' } = {}] = entries || [] 
			await c.bindPromise(userDn || '', userPwd)
		} catch (error) {
			throw new Error('用户认证异常')
		}
  }
}

function convertVerifyPwdOptions2SearchOptions(
  o: IVerifyPasswordOptions
): SearchOptions {
  const { searchOptions, filter2ReplaceKey } = o || {};
  const { filter, ...otherSearhOptions } = searchOptions || {};
  const filterStrings = Object.entries(filter).map(([k, v]) => {
    const objectKeys = Object.keys(filter2ReplaceKey || {});
    const newVal = objectKeys.reduce((t, aliasKey) => {
      const replaceValue = o?.[filter2ReplaceKey?.[aliasKey]];
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
