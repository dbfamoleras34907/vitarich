export async function GET() {
    try {
        const res = await fetch(
            "https://appvcbreederstaging.vitarich.com/dispatch/all",
            {
                cache: "no-store",
            }
        )

        const data = await res.json()
        // const filtered = (data || []).filter(
        //     (item: any) => item.dispatchbody?.length > 0
        // )
        return Response.json(data)
    } catch (err) {
        // console.error({err})
        return Response.json(
            { error: err },
            { status: 500 }
        )
    }
}