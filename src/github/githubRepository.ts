/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as Octokit from '@octokit/rest';
import Logger from "../common/logger";
import { Remote } from "../common/remote";
import { PRType } from "./interface";
import { PullRequestModel } from "./pullRequestModel";

export const PULL_REQUEST_PAGE_SIZE = 20;

export interface PullRequestData {
	pullRequests: PullRequestModel[];
	hasMorePages: boolean;
}
export class GitHubRepository {

	constructor(public readonly remote: Remote, public readonly octokit: Octokit) {
	}

	async getPullRequests(prType: PRType, page?: number): Promise<PullRequestData> {
		return prType === PRType.All ? this.getAllPullRequests(page) : this.getPullRequestsForCategory(prType, page);
	}

	private async getAllPullRequests(page?: number): Promise<PullRequestData> {
		try {
			const result = await this.octokit.pullRequests.getAll({
				owner: this.remote.owner,
				repo: this.remote.repositoryName,
				per_page: PULL_REQUEST_PAGE_SIZE,
				page: page || 1
			});

			const hasMorePages = !!result.headers.link && result.headers.link.indexOf('rel="next"') > -1;
			const pullRequests = result.data.map(item => {
				if (!item.head.repo) {
					Logger.appendLine('GitHubRepository> The remote branch for this PR was already deleted.');
					return null;
				}
				return new PullRequestModel(this, this.remote, item);
			}).filter(item => item !== null);

			return {
				pullRequests,
				hasMorePages
			}
		} catch (e) {
			Logger.appendLine(`GitHubRepository> Fetching all pull requests failed: ${e}`);
			throw e;
		}
	}

	private async getPullRequestsForCategory(prType: PRType, page: number): Promise<PullRequestData> {
		try {
			const user = await this.octokit.users.get({});
			// Search api will not try to resolve repo that redirects, so get full name first
			const repo = await this.octokit.repos.get({owner: this.remote.owner, repo: this.remote.repositoryName});
			const { data, headers } = await this.octokit.search.issues({
				q: this.getPRFetchQuery(repo.data.full_name, user.data.login, prType),
				per_page: PULL_REQUEST_PAGE_SIZE,
				page: page || 1
			});
			let promises = [];
			data.items.forEach(item => {
				promises.push(new Promise(async (resolve, reject) => {
					let prData = await this.octokit.pullRequests.get({
						owner: this.remote.owner,
						repo: this.remote.repositoryName,
						number: item.number
					});
					resolve(prData);
				}));
			});

			const hasMorePages = !!headers.link && headers.link.indexOf('rel="next"') > -1;
			const pullRequests = await Promise.all(promises).then(values => {
				return values.map(item => {
					if (!item.data.head.repo) {
						Logger.appendLine('GitHubRepository> The remote branch for this PR was already deleted.');
						return null;
					}
					return new PullRequestModel(this, this.remote, item.data);
				}).filter(item => item !== null);
			});

			return {
				pullRequests,
				hasMorePages
			}
		} catch (e) {
			Logger.appendLine(`GitHubRepository> Fetching pull requests failed: ${e}`);
			throw e;
		}
	}

	async getPullRequest(id: number): Promise<PullRequestModel> {
		try {
			let { data } = await this.octokit.pullRequests.get({
				owner: this.remote.owner,
				repo: this.remote.repositoryName,
				number: id
			});

			if (!data.head.repo) {
				Logger.appendLine('GitHubRepository> The remote branch for this PR was already deleted.');
				return null;
			}

			return new PullRequestModel(this, this.remote, data);
		} catch (e) {
			Logger.appendLine(`GithubRepository> Unable to fetch PR: ${e}`);
			return null;
		}
	}

	private getPRFetchQuery(repo: string, user: string, type: PRType) {
		let filter = '';
		switch (type) {
			case PRType.RequestReview:
				filter = `review-requested:${user}`;
				break;
			case PRType.AssignedToMe:
				filter = `assignee:${user}`;
				break;
			case PRType.Mine:
				filter = `author:${user}`;
				break;
			default:
				break;
		}

		return `is:open ${filter} type:pr repo:${repo}`;
	}
}