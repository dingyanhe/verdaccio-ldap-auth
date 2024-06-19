export class LdapAuthTimeoutError extends Error {
	_isLdapAuth = true
}

export function timeout2Throw(msec, timeoutMessage) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new LdapAuthTimeoutError(timeoutMessage || `timeout of ${msec}ms exceeded`));
    }, msec);
  });
}
