import JDParser from '@/lib/jd-parser';

const testText = `Template \` HayGr oup Jo b Description Template 2017 Basic Details: Fill the required information about business, unit, location, position, reports to position and date of updation of JD Business Paint Manufacturing Unit B W New Project (BNP01) Location Project Site, Panipat Position Number of the role Reports to ...
Requirements (one per line)
such as pollution clearance, factory inspection,
electricity board clearance to en su re al l required
clearances for one ' s site are procured timely .
Maintain a condusive work environment`;

async function main() {
    console.log("Starting JD Parser test...");
    const parser = new JDParser(process.env.OPENAI_API_KEY);
    const result = await parser.parseJD(testText, "Member_Electrical-1.pdf");
    console.log("FINAL PARSED RESULT:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
