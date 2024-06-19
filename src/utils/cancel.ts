const defer = () => {
	let resolve
	let reject
	const promise = new Promise<void>((r, rej) => {
		resolve = r
		reject = rej
	})

	return { resolve, reject, promise }
}

class CancelError extends Error {
	_isCancel = true
}

interface ICancelFn {
	(message: string): void
}

export class CancelToken {
	promise = Promise.resolve()

	cancelError: CancelError | null = null

	constructor(executor: (cancelFn: ICancelFn) => void) {
		if (typeof executor !== 'function') {
			throw new TypeError('executor不是函数')
		}

		const { resolve, promise } = defer()
		this.promise = promise

		executor((msg) => {
			if (this.cancelError) {
				// 已经取消
				return
			}
			this.cancelError = new CancelError(msg)
			resolve(this.cancelError)
		})
	}

	static source() {
		let cancel!: ICancelFn
		const token = new CancelToken((fn) => {
			cancel = fn
		})
		return {
			token,
			cancel,
		}
	}
}

export const cancelThrowError = (cancelToken: CancelToken) => {
	const { reject, promise } = defer()
	cancelToken.promise.then(reject)
	return promise
}
