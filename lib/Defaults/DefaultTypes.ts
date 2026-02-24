export interface CodeNameBase {
    code?: string;
    name?: string;
}

export interface SeriesInterface {
    id?: number;
    code?: string;
    name?: string;
}

export interface SeriesIntf {
    branch?: string;
    code?: string;
    name?: string;
    firstNo?: number
    nextno?: number
    prefixA?: string
    prefixB?: string
    prefixC?: string
    numofdigit?: number
    yearperiod?: number
    docStatus?: string
}



export type RowDataKey = {
    id: number
    [key: string]: any
}


export type ColumnConfig = {
    key: string;
    label: string;
    searchWithKey?: string | null;
    searchOutputKey?: string | null;
    codeKey?: string | null;
    nameKey?: string | null;
    filterWith?: string | null;
    type: "text" | "number" | "currency" | "date" | "search" | "button";
    data?: any[];
    required?: boolean;
    disabled?: boolean;
    width?: number | string;

};





export type VwDmfReceivingDraftPending = {
    id: number
    posting_date: string
    email: string | null
    status: 'Pending' | 'Posted' | 'Cancelled' | 'Draft'
}
