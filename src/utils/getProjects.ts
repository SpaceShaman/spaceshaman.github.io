import * as cheerio from 'cheerio'

export default async function getProjects(): Promise<Project[]> {
	const profileUrl = 'https://github.com/SpaceShaman'
	const response = await fetch(profileUrl, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (compatible; StaticSite/1.0)',
		},
	})
	if (!response.ok) {
		throw new Error(`Failed to fetch profile: ${response.statusText}`)
	}
	const html = await response.text()
	return extractPinnedProjects(html)
}

function extractPinnedProjects(html: string): Project[] {
	const $ = cheerio.load(html)
	const projects: Project[] = []

	$('.js-pinned-item-list-item').each((_, element) => {
		const name = $(element).find('.repo').text().trim()
		const description = $(element).find('.pinned-item-desc').text().trim()
		const language = $(element)
			.find('[itemprop="programmingLanguage"]')
			.text()
			.trim()
		const stars = parseInt(
			$(element).find('a[href*="stargazers"]').text().trim() || '0',
			10
		)
		const forks = parseInt(
			$(element).find('a[href*="forks"]').text().trim() || '0',
			10
		)
		const url = $(element).find('.repo').closest('a').attr('href') || ''

		if (name) {
			projects.push({
				name,
				description,
				language,
				stars,
				forks,
				url: `https://github.com${url}`,
			})
		}
	})

	return projects
}
