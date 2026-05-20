'use client'

import CodeBlock from '@/components/ui/code-block'
import { useAllowedFarms } from '@/hooks/useAllowedFarms';

type Props = {
    dateFrom: string | undefined
    dateTo: string | undefined
    region: string | undefined
    archipelago: string | undefined
}

export default function ParamsSysDrep({
    dateFrom,
    dateTo,
    region,
    archipelago
}: Props) {

    const allowedFarms = useAllowedFarms();

    const farmCodes = allowedFarms
        ?.map((farm) => `    '${farm.name.replace(/'/g, "''")}'`)
        .join(',\n');

    const sql = `
SELECT 
    all
FROM database
WHERE${dateFrom ? ` Date >= '${dateFrom}'` : ''}
${dateTo ? `AND Date <= '${dateTo}'` : ''}
${region ? `AND Region = '${region}'` : ''}
${archipelago ? `AND Archipelago = '${archipelago}'` : ''}
${farmCodes ? `and FarmCode IN (
${farmCodes}
)` : ''}
`;

    return (
        <CodeBlock
            code={sql.trim()}
            lang="sql"
            title="Customer Query"
        />
    )
}