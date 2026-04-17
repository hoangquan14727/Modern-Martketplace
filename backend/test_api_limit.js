
async function testApi() {
    try {
        const response = await fetch('http://localhost:5000/api/products?limit=1000');
        const data = await response.json();
        console.log('Success:', data.success);
        console.log('Total in DB (pagination.total):', data.pagination.total);
        console.log('Returned Items (data.length):', data.data.length);
        console.log('Limit param used (pagination.limit):', data.pagination.limit);
    } catch (e) {
        console.error('Error:', e);
    }
}

testApi();
