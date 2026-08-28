import { Global, Module } from '@nestjs/common';
import { JsonDatabase } from './json/json-database';
import {
  JsonAuditRepository,
  JsonCustomerAccountRepository,
  JsonRefreshTokenRepository,
  JsonUserRepository,
} from './json/json-repositories';
import {
  AUDIT_REPOSITORY,
  CUSTOMER_ACCOUNT_REPOSITORY,
  DATA_STORE,
  REFRESH_TOKEN_REPOSITORY,
  USER_REPOSITORY,
} from './repositories';

/**
 * Binds the repository contracts to a driver. Only the JSON document store is
 * wired today; a Prisma/PostgreSQL driver slots in here by swapping the
 * `useClass` targets, with no change to the services that consume them.
 */
@Global()
@Module({
  providers: [
    JsonDatabase,
    { provide: DATA_STORE, useExisting: JsonDatabase },
    { provide: USER_REPOSITORY, useClass: JsonUserRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: JsonRefreshTokenRepository },
    { provide: AUDIT_REPOSITORY, useClass: JsonAuditRepository },
    { provide: CUSTOMER_ACCOUNT_REPOSITORY, useClass: JsonCustomerAccountRepository },
  ],
  exports: [
    DATA_STORE,
    USER_REPOSITORY,
    REFRESH_TOKEN_REPOSITORY,
    AUDIT_REPOSITORY,
    CUSTOMER_ACCOUNT_REPOSITORY,
  ],
})
export class StorageModule {}
