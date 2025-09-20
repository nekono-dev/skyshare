import { Redis } from "@upstash/redis/cloudflare";
import dev_readPagedb from "./function.dev"
import readPagedb from "./function.prod"

export interface Env {
	UPSTASH_REDIS_REST_URL: string,
	UPSTASH_REDIS_REST_TOKEN: string,
	DEV_UPSTASH_REDIS_REST_URL: string,
	DEV_UPSTASH_REDIS_REST_TOKEN: string,
	ENV: string
}

export default {
	async fetch(request: Request, env: Env) {
		let corsHeaders = {}
		if (env.ENV === "prod") {
			corsHeaders = {
				"Access-Control-Allow-Origin": "https://skyshare.nekono.dev",
				"Access-Control-Allow-Methods": "GET,OPTIONS",
				"Access-Control-Allow-Headers": 'Content-Type',
			};
		}else {
			corsHeaders = {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET,OPTIONS",
				"Access-Control-Allow-Headers": 'Content-Type',
			};
		}

		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: corsHeaders
			});
		}

		let restUrl = env.DEV_UPSTASH_REDIS_REST_URL
		let restToken = env.DEV_UPSTASH_REDIS_REST_TOKEN
		if (env.ENV === "prod") {
			restUrl = env.UPSTASH_REDIS_REST_URL
			restToken = env.UPSTASH_REDIS_REST_TOKEN
		}
		const redis = Redis.fromEnv({
			UPSTASH_REDIS_REST_URL: restUrl,
			UPSTASH_REDIS_REST_TOKEN: restToken,
		});

		let data:object = {}
		if (env.ENV === "prod") {
			data = await readPagedb({
				redis: redis,
				request: request
			})

		} else {
			data = await dev_readPagedb({
				redis: redis,
				request: request
			})
		}
		const response = new Response(
			JSON.stringify(data), {
			status: 200,
			headers: corsHeaders
		})
		return response;
	},
}; 
