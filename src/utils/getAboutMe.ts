export default async function getAboutMe(): Promise<string> {
	const readmeUrl =
		'https://raw.githubusercontent.com/SpaceShaman/SpaceShaman/master/README.md'
	const response = await fetch(readmeUrl)
	if (!response.ok) {
		throw new Error(`Failed to fetch README: ${response.statusText}`)
	}
	const readme = await response.text()
	return extractAboutMeFromReadme(readme)
}

function extractAboutMeFromReadme(readme: string): string {
	const startTag = '<!-- START: description -->'
	const endTag = '<!-- END: description -->'
	const startIndex = readme.indexOf(startTag) + startTag.length
	const endIndex = readme.indexOf(endTag)
	if (startIndex === -1 || endIndex === -1) {
		throw new Error('Personal details not found in README')
	}
	return readme.substring(startIndex, endIndex).trim()
}
