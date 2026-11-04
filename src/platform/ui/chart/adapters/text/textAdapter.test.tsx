// @vitest-environment jsdom
import { toChartPoints } from '@/platform/lib/chart/table'

import { describeChartAdapter } from '../../chartAdapter.contract'

import { textAdapter } from './textAdapter'

describeChartAdapter(textAdapter, { markCount: (spec) => toChartPoints(spec).length })
