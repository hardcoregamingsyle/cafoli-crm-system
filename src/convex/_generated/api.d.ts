/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as audit from "../audit.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as auth from "../auth.js";
import type * as comments from "../comments.js";
import type * as crons from "../crons.js";
import type * as emailKeys from "../emailKeys.js";
import type * as emails from "../emails.js";
import type * as http from "../http.js";
import type * as leads from "../leads.js";
import type * as notifications from "../notifications.js";
import type * as sms from "../sms.js";
import type * as users from "../users.js";
import type * as webhook from "../webhook.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  audit: typeof audit;
  "auth/emailOtp": typeof auth_emailOtp;
  auth: typeof auth;
  comments: typeof comments;
  crons: typeof crons;
  emailKeys: typeof emailKeys;
  emails: typeof emails;
  http: typeof http;
  leads: typeof leads;
  notifications: typeof notifications;
  sms: typeof sms;
  users: typeof users;
  webhook: typeof webhook;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
