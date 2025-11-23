/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as campaigns from "../campaigns.js";
import type * as comments from "../comments.js";
import type * as crons from "../crons.js";
import type * as emailKeys from "../emailKeys.js";
import type * as emails from "../emails.js";
import type * as http from "../http.js";
import type * as leads from "../leads.js";
import type * as masterdata from "../masterdata.js";
import type * as migrate from "../migrate.js";
import type * as notifications from "../notifications.js";
import type * as sms from "../sms.js";
import type * as smsTracking from "../smsTracking.js";
import type * as users from "../users.js";
import type * as webhook from "../webhook.js";
import type * as whatsapp from "../whatsapp.js";
import type * as whatsappMedia from "../whatsappMedia.js";
import type * as whatsappPortal from "../whatsappPortal.js";
import type * as whatsappQueries from "../whatsappQueries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audit: typeof audit;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  campaigns: typeof campaigns;
  comments: typeof comments;
  crons: typeof crons;
  emailKeys: typeof emailKeys;
  emails: typeof emails;
  http: typeof http;
  leads: typeof leads;
  masterdata: typeof masterdata;
  migrate: typeof migrate;
  notifications: typeof notifications;
  sms: typeof sms;
  smsTracking: typeof smsTracking;
  users: typeof users;
  webhook: typeof webhook;
  whatsapp: typeof whatsapp;
  whatsappMedia: typeof whatsappMedia;
  whatsappPortal: typeof whatsappPortal;
  whatsappQueries: typeof whatsappQueries;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
