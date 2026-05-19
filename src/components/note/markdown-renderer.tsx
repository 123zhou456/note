'use client'

import React, { useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronRight, ChevronDown } from 'lucide-react'

interface MarkdownRendererProps {
  content: string
  color?: string
  foldStates: Record<string, boolean>
  onToggleFold: (headingId: string) => void
}

interface Section {
  heading: string | null
  headingId: string | null
  content: string
  level: number
}

// Split markdown into sections by H1/H2 headings
function splitIntoSections(markdown: string): Section[] {
  const lines = markdown.split('\n')
  const sections: Section[] = []
  let currentSection: Section = {
    heading: null,
    headingId: null,
    content: '',
    level: 0,
  }

  for (const line of lines) {
    // Check for H1: # Title
    const h1Match = line.match(/^# (.+)$/)
    // Check for H2: ## Title
    const h2Match = line.match(/^## (.+)$/)

    if (h1Match) {
      // Push the current section if it has content or heading
      if (currentSection.heading !== null || currentSection.content.trim() !== '') {
        sections.push({ ...currentSection })
      }
      const headingText = h1Match[1].trim()
      const headingId = `h1-${headingText.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '-').toLowerCase()}-${sections.length}`
      currentSection = { heading: headingText, headingId, content: '', level: 1 }
    } else if (h2Match) {
      // Push the current section if it has content or heading
      if (currentSection.heading !== null || currentSection.content.trim() !== '') {
        sections.push({ ...currentSection })
      }
      const headingText = h2Match[1].trim()
      const headingId = `h2-${headingText.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '-').toLowerCase()}-${sections.length}`
      currentSection = { heading: headingText, headingId, content: '', level: 2 }
    } else {
      // Add line to current section's content
      if (currentSection.content.length > 0) {
        currentSection.content += '\n'
      }
      currentSection.content += line
    }
  }

  // Push the last section
  if (currentSection.heading !== null || currentSection.content.trim() !== '') {
    sections.push(currentSection)
  }

  return sections
}

export default function MarkdownRenderer({ content, color, foldStates, onToggleFold }: MarkdownRendererProps) {
  const renderMarkdown = useCallback(
    (md: string) => (
      <div style={color ? { color } : undefined} className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {md}
        </ReactMarkdown>
      </div>
    ),
    [color]
  )

  // If no content, return empty
  if (!content || !content.trim()) {
    return null
  }

  const sections = splitIntoSections(content)

  // Check if there are any H1/H2 headings
  const hasHeadings = sections.some((s) => s.level === 1 || s.level === 2)

  if (!hasHeadings) {
    // No headings - render as plain markdown
    return <>{renderMarkdown(content)}</>
  }

  return (
    <div className="space-y-1">
      {sections.map((section, index) => {
        // If this section has a heading (H1 or H2), render as collapsible
        if (section.level === 1 || section.level === 2) {
          const isCollapsed = section.headingId ? foldStates[section.headingId] === true : false
          const headingClass = section.level === 1
            ? 'text-xl font-bold'
            : 'text-lg font-semibold'

          return (
            <div key={section.headingId || `section-${index}`} className="my-2">
              <Collapsible
                open={!isCollapsed}
                onOpenChange={() => {
                  if (section.headingId) onToggleFold(section.headingId)
                }}
              >
                <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left hover:bg-accent/50 rounded-md px-1.5 py-1 transition-colors">
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span
                    className={headingClass}
                    style={color ? { color } : undefined}
                  >
                    {section.heading}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-5 mt-1">
                    {section.content.trim() && renderMarkdown(section.content)}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )
        }

        // Non-heading section (content before any heading)
        return (
          <div key={`section-${index}`} className="my-2">
            {renderMarkdown(section.content)}
          </div>
        )
      })}
    </div>
  )
}
