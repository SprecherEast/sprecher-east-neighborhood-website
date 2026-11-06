import React from 'react'
import { MapPin, Mail } from 'lucide-react'

import { resolveLink } from '@/platform/payload/resolveLink'
import { Link } from '@/platform/ui'
import { MetaList } from '@/platform/ui/MetaList'
import { Text } from '@/platform/ui/Text'

import { toForumUrl } from '../domain/forum'
import { getFooter } from '../data/globals'
import { LogoLink } from './Logo'

export async function SiteFooter() {
  const footerData = await getFooter()

  const navItems = footerData?.navItems || []
  // One click to the forum from every page, home included (#485)
  const forumUrl = toForumUrl(footerData?.forumUrl)
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-border bg-surface" data-theme="dark">
      <div className="container py-14 md:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-12">
          {/* Brand column */}
          <div className="space-y-4">
            <LogoLink logoClassName="text-2xl" />
            <Text variant="small" className="max-w-xs">
              Connecting neighbors on Madison&apos;s Far East Side.
            </Text>
          </div>

          {/* Quick links column */}
          <div>
            <Text variant="label" as="h2" className="mb-5">
              Quick Links
            </Text>
            <nav aria-label="Footer" className="flex flex-col gap-1">
              {navItems.map(({ link }, i) => {
                const resolved = resolveLink(link)
                if (!resolved) return null
                return (
                  <Link
                    key={i}
                    href={resolved.href}
                    external={resolved.external}
                    variant="muted"
                    className="self-start"
                  >
                    {resolved.label}
                  </Link>
                )
              })}
              {forumUrl && (
                <Link href={forumUrl} external variant="muted" className="self-start">
                  Neighborhood forum
                </Link>
              )}
            </nav>
          </div>

          {/* Contact column */}
          <div>
            <Text variant="label" as="h2" className="mb-5">
              Get in Touch
            </Text>
            <MetaList
              className="text-sm text-muted-foreground"
              items={[
                { icon: <MapPin className="text-primary" />, value: 'Madison, WI' },
                {
                  icon: <Mail className="text-primary" />,
                  value: (
                    <Link href="/contact" variant="muted" className="font-medium">
                      Contact us
                    </Link>
                  ),
                },
              ]}
            />
          </div>
        </div>

        {/* Disclaimer + copyright */}
        <div className="mt-12 border-t border-border pt-8">
          <Text variant="small" className="mb-2">
            Sprecher East is an unofficial grassroots neighborhood initiative. This website was
            built with AI assistance.
          </Text>
          <Text variant="small">&copy; {currentYear} Sprecher East</Text>
        </div>
      </div>
    </footer>
  )
}
