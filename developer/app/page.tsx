import { Card, CardBody, CardTitle } from '@/platform/ui/Card'
import { CardGrid, CardGridItem } from '@/platform/ui/CardGrid'
import { PAGE_SHELL } from '@/platform/ui/layoutSizes'
import { PageHeader } from '@/platform/ui/PageHeader'
import { Text } from '@/platform/ui/Text'

/**
 * The developer home page (a placeholder until the shell lands, #1531): where the people building
 * the site start. Nothing here is private, so it needs no sign-in.
 */
export default function DeveloperHomePage() {
  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        eyebrow="Sprecher East developer pages"
        title="For the people building Sprecher East"
        description="Unofficial tools, made with AI tools. Nothing here is private, and search engines are asked to skip it."
      />
      <div className="container">
        <CardGrid columns={2}>
          <CardGridItem>
            <Card interactive padding="none">
              <CardBody>
                <CardTitle href="/showcase/">Component showcase</CardTitle>
                <Text variant="small">Every shared piece of the site, in light and dark.</Text>
              </CardBody>
            </Card>
          </CardGridItem>
        </CardGrid>
      </div>
    </div>
  )
}
