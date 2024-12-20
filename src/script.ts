// Function to generate random sample data
function generateSampleData(inputString: string): { data: string[][], rows: number } {
    const rows = Math.floor(Math.random() * 10) + 5; // 5-15 rows
    const cols = 3; // Fixed number of columns
    const data: string[][] = [["Input", "Random Number", "Random Text"]];

    for (let i = 0; i < rows; i++) {
        const randomNum = Math.floor(Math.random() * 1000);
        const randomText = Math.random().toString(36).substring(7);
        data.push([inputString, randomNum.toString(), randomText]);
    }
    return { data, rows };
}

// Function to convert data array to CSV string
function arrayToCsv(data: string[][]): string {
    return data.map(row => row.join(",")).join("\n");
}

// Function to trigger CSV file download
function downloadCsv(filename: string, content: string): void {
    const blob = new Blob([content], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Event listener for button click
document.getElementById("generateCsv")?.addEventListener("click", () => {
    const inputString = (document.getElementById("inputString") as HTMLInputElement).value;
    if (!inputString) {
        alert("Please enter a string.");
        return;
    }

    const { data, rows } = generateSampleData(inputString);
    const csvContent = arrayToCsv(data);

    const summaryMessage = document.getElementById("summaryMessage");
    const downloadButton = document.getElementById("downloadCsv");

    if (summaryMessage && downloadButton) {
        summaryMessage.textContent = `CSV file generated with ${rows} rows. Click below to download.`;
        summaryMessage.style.display = "block";
        downloadButton.style.display = "inline-block";

        downloadButton.onclick = () => {
            downloadCsv("sample_data.csv", csvContent);
        };
    }
});
