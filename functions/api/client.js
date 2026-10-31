export async function onRequest(context) {
    // 1. Get the client name from the URL (e.g., ?name=Arif)
    const url = new URL(context.request.url);
    const clientName = url.searchParams.get("name");

    if (!clientName) {
        return new Response(JSON.stringify({ error: "No client name provided" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    // 2. Connect to your database (MOCK DATA FOR NOW)
    // Later, we will replace this mock data with the real data from your dairy app.
    const mockData = [
        { date: "2023-10-01", liters: 50, rate: 150, total: 7500 },
        { date: "2023-10-15", liters: 60, rate: 150, total: 9000 }
    ];

    // 3. Calculate the totals
    let totalLiters = 0;
    let totalDue = 0;
    mockData.forEach(record => {
        totalLiters += record.liters;
        totalDue += record.total;
    });

    // 4. Send the data back to SAWAA
    return new Response(JSON.stringify({
        client: clientName,
        totalLiters: totalLiters,
        totalDue: totalDue,
        message: `${clientName} took ${totalLiters} liters this month. Total due is ${totalDue} rupees.`
    }), {
        headers: { "Content-Type": "application/json" },
    });
}
