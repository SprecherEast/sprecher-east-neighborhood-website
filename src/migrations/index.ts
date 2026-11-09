import * as migration_20260303_010747_initial from './20260303_010747_initial'
import * as migration_20260304_035927_add_events_seo_fields from './20260304_035927_add_events_seo_fields'
import * as migration_20260304_205039 from './20260304_205039'
import * as migration_20261018_044131_payload_3_91_upgrade from './20261018_044131_payload_3_91_upgrade'
import * as migration_20261021_233720_backfill_seo_image_versions from './20261021_233720_backfill_seo_image_versions'
import * as migration_20261022_211619_email_confirmations from './20261022_211619_email_confirmations'
import * as migration_20261022_213133_contact_sender_email from './20261022_213133_contact_sender_email'
import * as migration_20261023_183632_account_verification from './20261023_183632_account_verification'
import * as migration_20261023_211151_verification_resends from './20261023_211151_verification_resends'
import * as migration_20261023_214345_held_form_emails from './20261023_214345_held_form_emails'
import * as migration_20261024_141700_contact_retention from './20261024_141700_contact_retention'
import * as migration_20261024_164157_review_queue from './20261024_164157_review_queue'
import * as migration_20261024_180000_cancel_missed_scheduled_publishes from './20261024_180000_cancel_missed_scheduled_publishes'
import * as migration_20261024_194426_agent_mcp_access from './20261024_194426_agent_mcp_access'
import * as migration_20261025_195057_shared_categories from './20261025_195057_shared_categories'
import * as migration_20261026_025719_verified_token_hash from './20261026_025719_verified_token_hash'
import * as migration_20261026_054957_media_license_url from './20261026_054957_media_license_url'
import * as migration_20261027_064445_official_meetings from './20261027_064445_official_meetings'
import * as migration_20261027_072713_this_week_strip from './20261027_072713_this_week_strip'
import * as migration_20261027_150134_top_issues from './20261027_150134_top_issues'
import * as migration_20261027_184942_search_status_source from './20261027_184942_search_status_source'
import * as migration_20261027_193414_forum_url from './20261027_193414_forum_url'
import * as migration_20261031_214018_guest_role from './20261031_214018_guest_role'
import * as migration_20261101_182251_resource_portraits from './20261101_182251_resource_portraits'
import * as migration_20261107_015722_map_block from './20261107_015722_map_block'
import * as migration_20261107_042752_page_backdrop from './20261107_042752_page_backdrop'
import * as migration_20261108_032245_section_block from './20261108_032245_section_block'
import * as migration_20261109_204957_link_align from './20261109_204957_link_align'

export const migrations = [
  {
    up: migration_20260303_010747_initial.up,
    down: migration_20260303_010747_initial.down,
    name: '20260303_010747_initial',
  },
  {
    up: migration_20260304_035927_add_events_seo_fields.up,
    down: migration_20260304_035927_add_events_seo_fields.down,
    name: '20260304_035927_add_events_seo_fields',
  },
  {
    up: migration_20260304_205039.up,
    down: migration_20260304_205039.down,
    name: '20260304_205039',
  },
  {
    up: migration_20261018_044131_payload_3_91_upgrade.up,
    down: migration_20261018_044131_payload_3_91_upgrade.down,
    name: '20261018_044131_payload_3_91_upgrade',
  },
  {
    up: migration_20261021_233720_backfill_seo_image_versions.up,
    down: migration_20261021_233720_backfill_seo_image_versions.down,
    name: '20261021_233720_backfill_seo_image_versions',
  },
  {
    up: migration_20261022_211619_email_confirmations.up,
    down: migration_20261022_211619_email_confirmations.down,
    name: '20261022_211619_email_confirmations',
  },
  {
    up: migration_20261022_213133_contact_sender_email.up,
    down: migration_20261022_213133_contact_sender_email.down,
    name: '20261022_213133_contact_sender_email',
  },
  {
    up: migration_20261023_183632_account_verification.up,
    down: migration_20261023_183632_account_verification.down,
    name: '20261023_183632_account_verification',
  },
  {
    up: migration_20261023_211151_verification_resends.up,
    down: migration_20261023_211151_verification_resends.down,
    name: '20261023_211151_verification_resends',
  },
  {
    up: migration_20261023_214345_held_form_emails.up,
    down: migration_20261023_214345_held_form_emails.down,
    name: '20261023_214345_held_form_emails',
  },
  {
    up: migration_20261024_141700_contact_retention.up,
    down: migration_20261024_141700_contact_retention.down,
    name: '20261024_141700_contact_retention',
  },
  {
    up: migration_20261024_164157_review_queue.up,
    down: migration_20261024_164157_review_queue.down,
    name: '20261024_164157_review_queue',
  },
  {
    up: migration_20261024_180000_cancel_missed_scheduled_publishes.up,
    down: migration_20261024_180000_cancel_missed_scheduled_publishes.down,
    name: '20261024_180000_cancel_missed_scheduled_publishes',
  },
  {
    up: migration_20261024_194426_agent_mcp_access.up,
    down: migration_20261024_194426_agent_mcp_access.down,
    name: '20261024_194426_agent_mcp_access',
  },
  {
    up: migration_20261025_195057_shared_categories.up,
    down: migration_20261025_195057_shared_categories.down,
    name: '20261025_195057_shared_categories',
  },
  {
    up: migration_20261026_025719_verified_token_hash.up,
    down: migration_20261026_025719_verified_token_hash.down,
    name: '20261026_025719_verified_token_hash',
  },
  {
    up: migration_20261026_054957_media_license_url.up,
    down: migration_20261026_054957_media_license_url.down,
    name: '20261026_054957_media_license_url',
  },
  {
    up: migration_20261027_064445_official_meetings.up,
    down: migration_20261027_064445_official_meetings.down,
    name: '20261027_064445_official_meetings',
  },
  {
    up: migration_20261027_072713_this_week_strip.up,
    down: migration_20261027_072713_this_week_strip.down,
    name: '20261027_072713_this_week_strip',
  },
  {
    up: migration_20261027_150134_top_issues.up,
    down: migration_20261027_150134_top_issues.down,
    name: '20261027_150134_top_issues',
  },
  {
    up: migration_20261027_184942_search_status_source.up,
    down: migration_20261027_184942_search_status_source.down,
    name: '20261027_184942_search_status_source',
  },
  {
    up: migration_20261027_193414_forum_url.up,
    down: migration_20261027_193414_forum_url.down,
    name: '20261027_193414_forum_url',
  },
  {
    up: migration_20261031_214018_guest_role.up,
    down: migration_20261031_214018_guest_role.down,
    name: '20261031_214018_guest_role',
  },
  {
    up: migration_20261101_182251_resource_portraits.up,
    down: migration_20261101_182251_resource_portraits.down,
    name: '20261101_182251_resource_portraits',
  },
  {
    up: migration_20261107_015722_map_block.up,
    down: migration_20261107_015722_map_block.down,
    name: '20261107_015722_map_block',
  },
  {
    up: migration_20261107_042752_page_backdrop.up,
    down: migration_20261107_042752_page_backdrop.down,
    name: '20261107_042752_page_backdrop',
  },
  {
    up: migration_20261108_032245_section_block.up,
    down: migration_20261108_032245_section_block.down,
    name: '20261108_032245_section_block',
  },
  {
    up: migration_20261109_204957_link_align.up,
    down: migration_20261109_204957_link_align.down,
    name: '20261109_204957_link_align',
  },
]
