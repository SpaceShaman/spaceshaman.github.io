export default async function getSkills(): Promise<Skill[]> {
	const readmeUrl =
		'https://raw.githubusercontent.com/SpaceShaman/SpaceShaman/master/README.md'
	const response = await fetch(readmeUrl)
	if (!response.ok) {
		throw new Error(`Failed to fetch README: ${response.statusText}`)
	}
	const readme = await response.text()
	return extractSkillsFromReadme(readme)
}

function extractSkillsFromReadme(readme: string): Skill[] {
	const startTag = '<!-- START: skills -->'
	const endTag = '<!-- END: skills -->'
	const startIndex = readme.indexOf(startTag) + startTag.length
	const endIndex = readme.indexOf(endTag)
	if (startIndex === -1 || endIndex === -1) {
		throw new Error('Skills not found in README')
	}
	const skillsSection = readme.substring(startIndex, endIndex).trim()
	const skillRegex = /\[!\[(.*?)\]\((.*?)\)\]\((.*?)\)/g
	const skills: Skill[] = []
	let match
	while ((match = skillRegex.exec(skillsSection)) !== null) {
		const skillName = match[1]
		const skillUrl = match[3]
		skills.push({ name: skillName, url: skillUrl })
	}
	return skills
}
