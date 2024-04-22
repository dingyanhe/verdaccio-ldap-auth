import {Config} from '@verdaccio/types';
import { ClientOptions } from 'ldapjs';
import { IVerifyPasswordOptions } from '../src/utils/ldapLogin';

export interface PluginAuthConfig extends Config {
  clientOptions: ClientOptions
  verifyPasswordOptions: IVerifyPasswordOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}
