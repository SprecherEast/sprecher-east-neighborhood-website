import type { CollectionConfig } from 'payload'

import { anyone } from '@/platform/payload/anyone'
import { isAdmin, isAdminOrEditor, isAdminOrEditorFieldAccess } from '@/platform/payload/roles'
import { orderField } from './orderField'

export const TeamMembers: CollectionConfig<'team-members'> = {
  slug: 'team-members',
  defaultSort: 'order',
  access: {
    create: isAdminOrEditor,
    delete: isAdmin,
    read: anyone,
    update: isAdminOrEditor,
  },
  admin: {
    defaultColumns: ['name', 'memberType', 'role', 'status', 'order', 'updatedAt'],
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'memberType',
      type: 'select',
      required: true,
      defaultValue: 'board-member',
      options: [
        { label: 'Board Member', value: 'board-member' },
        { label: 'AI Agent', value: 'ai-agent' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'text',
      required: true,
      admin: { placeholder: 'e.g., President, Vice President, Treasurer' },
    },
    {
      name: 'title',
      type: 'text',
      admin: {
        placeholder: 'e.g., Content & Voice Agent',
        condition: (_, siblingData) => siblingData?.memberType === 'ai-agent',
      },
    },
    {
      name: 'bio',
      type: 'textarea',
    },
    {
      name: 'capabilities',
      type: 'textarea',
      admin: {
        placeholder: 'Describe what this AI agent can do...',
        condition: (_, siblingData) => siblingData?.memberType === 'ai-agent',
      },
    },
    {
      name: 'email',
      type: 'email',
      // Contact details stay private; the public API omits this field (#140)
      access: { read: isAdminOrEditorFieldAccess },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    orderField(),
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
    },
  ],
}
