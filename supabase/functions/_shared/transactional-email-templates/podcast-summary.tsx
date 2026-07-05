import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Podcastify'

interface PodcastSummaryProps {
  title?: string
  textContent?: string
  listenUrl?: string
  duration?: string
}

const PodcastSummaryEmail = ({
  title = 'Your Daily News Summary',
  textContent = '',
  listenUrl = '#',
  duration = '',
}: PodcastSummaryProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{title}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{title}</Heading>
        {duration ? <Text style={meta}>🎧 {duration}</Text> : null}

        <Section style={ctaSection}>
          <Button style={button} href={listenUrl}>
            ▶ Play Audio Summary
          </Button>
          <Text style={ctaHint}>
            Tap above to open the player in your browser.
          </Text>
        </Section>

        <Hr style={divider} />

        <Heading as="h2" style={h2}>
          Transcript
        </Heading>
        {renderTranscript(textContent)}

        <Hr style={divider} />
        <Text style={footer}>Sent with care by {SITE_NAME} 🦔</Text>
      </Container>
    </Body>
  </Html>
)

interface ParsedArticle {
  headline: string
  url: string
  context: string
  takeaway: string
}
interface ParsedSection {
  header: string
  articles: ParsedArticle[]
}

function parseTranscript(content: string): ParsedSection[] {
  const lines = content.split('\n').filter((l) => l.trim())
  const sections: ParsedSection[] = []
  let currentSection: ParsedSection | null = null
  let currentArticle: ParsedArticle | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (
      trimmed.startsWith('📰') ||
      /^#{1,3}\s/.test(trimmed) ||
      /^\*\*[^*]+\*\*$/.test(trimmed)
    ) {
      if (currentArticle && currentSection) currentSection.articles.push(currentArticle)
      currentArticle = null
      const headerText = trimmed
        .replace(/^#{1,3}\s*/, '')
        .replace(/^\*\*/, '')
        .replace(/\*\*$/, '')
        .trim()
      currentSection = {
        header: headerText.startsWith('📰') ? headerText : `📰 ${headerText}`,
        articles: [],
      }
      sections.push(currentSection)
      continue
    }
    if (/^[•\-\*]\s/.test(trimmed) || /^\d+[\.\)]\s/.test(trimmed)) {
      if (currentArticle && currentSection) currentSection.articles.push(currentArticle)
      const headline = trimmed
        .replace(/^[•\-\*]\s*/, '')
        .replace(/^\d+[\.\)]\s*/, '')
        .replace(/^\*\*/, '')
        .replace(/\*\*$/, '')
        .trim()
      currentArticle = { headline, url: '', context: '', takeaway: '' }
      if (!currentSection) {
        currentSection = { header: '📰 News', articles: [] }
        sections.push(currentSection)
      }
      continue
    }
    if (/^url:/i.test(trimmed) && currentArticle) {
      currentArticle.url = trimmed.replace(/^url:\s*/i, '').trim()
      continue
    }
    if (/^context:/i.test(trimmed) && currentArticle) {
      currentArticle.context = trimmed.replace(/^context:\s*/i, '').trim()
      continue
    }
    if (/^takeaway:/i.test(trimmed) && currentArticle) {
      currentArticle.takeaway = trimmed.replace(/^takeaway:\s*/i, '').trim()
      continue
    }
    if (currentArticle && !currentArticle.takeaway) {
      currentArticle.context += (currentArticle.context ? ' ' : '') + trimmed
    }
  }
  if (currentArticle && currentSection) currentSection.articles.push(currentArticle)
  return sections
}

function renderTranscript(content: string) {
  const sections = parseTranscript(content)
  if (sections.length === 0) {
    return <Text style={transcript}>{content}</Text>
  }
  return (
    <>
      {sections.map((section, i) => (
        <Section key={i} style={sectionBox}>
          <Text style={sectionHeader}>{section.header}</Text>
          {section.articles.map((article, j) => (
            <Section key={j} style={articleBlock}>
              {article.url ? (
                <Link href={article.url} style={headlineLink}>
                  {article.headline}
                </Link>
              ) : (
                <Text style={headlineText}>{article.headline}</Text>
              )}
              {article.context ? <Text style={contextText}>{article.context}</Text> : null}
              {article.takeaway ? (
                <Text style={takeawayText}>Takeaway: {article.takeaway}</Text>
              ) : null}
            </Section>
          ))}
        </Section>
      ))}
    </>
  )
}

export const template = {
  component: PodcastSummaryEmail,
  subject: (data: Record<string, any>) =>
    data?.title ? `${data.title} — ${SITE_NAME}` : `Your ${SITE_NAME} summary`,
  displayName: 'Podcast summary',
  previewData: {
    title: 'Top Stories - 4/26/2026',
    textContent:
      'Tech: A major AI breakthrough was announced today...\n\nFinance: Markets closed higher on...\n\nWorld: Diplomatic talks resumed in...',
    listenUrl: 'https://example.com/listen/abc123',
    duration: '3 min listen',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}
const container = { padding: '24px 28px', maxWidth: '600px', margin: '0 auto' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#1a1a2e',
  margin: '0 0 8px',
}
const h2 = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#1a1a2e',
  margin: '24px 0 12px',
}
const meta = { fontSize: '13px', color: '#7c6fb3', margin: '0 0 20px' }
const ctaSection = {
  textAlign: 'center' as const,
  padding: '16px 0',
}
const button = {
  backgroundColor: '#8b5cf6',
  color: '#ffffff',
  padding: '14px 28px',
  borderRadius: '999px',
  textDecoration: 'none',
  fontSize: '15px',
  fontWeight: 'bold',
  display: 'inline-block',
}
const ctaHint = { fontSize: '12px', color: '#888', margin: '12px 0 0' }
const divider = { borderColor: '#eee', margin: '24px 0' }
const transcript = {
  fontSize: '14px',
  color: '#333',
  lineHeight: '1.6',
  whiteSpace: 'pre-wrap' as const,
  margin: '0',
}
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0', textAlign: 'center' as const }
const sectionBox = {
  backgroundColor: '#f5f3ff',
  borderRadius: '8px',
  padding: '16px 18px',
  margin: '0 0 16px',
}
const sectionHeader = {
  fontSize: '15px',
  fontWeight: 'bold',
  color: '#6d28d9',
  margin: '0 0 12px',
}
const articleBlock = { margin: '0 0 14px' }
const headlineLink = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#1a1a2e',
  textDecoration: 'underline',
  display: 'block',
  margin: '0 0 4px',
}
const headlineText = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#1a1a2e',
  margin: '0 0 4px',
}
const contextText = {
  fontSize: '13px',
  color: '#444',
  lineHeight: '1.5',
  margin: '0 0 4px',
}
const takeawayText = {
  fontSize: '13px',
  color: '#7c3aed',
  fontStyle: 'italic' as const,
  margin: '0',
}

