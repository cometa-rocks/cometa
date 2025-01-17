
function insertRowContentsIntoDiv(rowHtml) {
  // Create a new div element
  const div = document.createElement("div");

  // Add a class or ID for styling or identification (optional)
  div.id = "rowContents";
  div.style.position = "fixed"; // Fixed position to make it always visible at the top
  div.style.top = "0"; // Place it at the top of the viewport
  div.style.left = "0"; // Align it to the left
  div.style.width = "100%"; // Make it full-width
  div.style.backgroundColor = "#ffffff"; // White background for visibility
  div.style.border = "1px solid #ccc";
  div.style.padding = "20px";
  div.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.1)"; // Add a shadow for prominence
  div.style.zIndex = "9999"; // High z-index to overlay other content

  // Populate the div with the row's HTML content
  div.innerHTML = `
      <h3>Row Details:</h3>
      ${rowHtml}
  `;

  // Add a close button for convenience
  const closeButton = document.createElement("button");
  closeButton.textContent = "Close";
  closeButton.style.float = "right";
  closeButton.style.padding = "5px 10px";
  closeButton.style.marginBottom = "10px";
  closeButton.style.border = "none";
  closeButton.style.backgroundColor = "#ff5e57";
  closeButton.style.color = "#fff";
  closeButton.style.cursor = "pointer";
  closeButton.style.borderRadius = "5px";

  closeButton.addEventListener("click", () => {
      div.remove(); // Remove the div when the button is clicked
  });

  div.prepend(closeButton); // Add the close button to the top of the div

  // Append the div to the body
  document.body.appendChild(div);
}


async function loadTableData(url, searchText) {
  try {
      // Fetch the raw content of the file
      const response = await fetch(url);

      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the raw content (Markdown in this case)
      const rawContent = await response.text();

      // Parse it as an HTML string if it contains table elements
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawContent, "text/html");

      // Look for the table rows
      const rows = doc.querySelectorAll("tr");
      for (const row of rows) {
          const cells = row.querySelectorAll("td");
          for (const cell of cells) {
              // Search for the text in the <td> elements
              if (cell.textContent.includes(searchText)) {
                  console.log("Row Found:", row.innerHTML);
                  return Array.from(cells).map(td => td.textContent.trim());
              }
          }
      }

      console.log(`No row found containing: "${searchText}"`);
      return null;
  } catch (error) {
      console.error("Error loading or processing data:", error);
  }
}

// Example Usage
const url = "https://raw.githubusercontent.com/cometa-rocks/cometa_documentation/main/cometa_actions.md"; // Replace with the raw URL
const searchText = 'Make an API call with "{method}" to "{endpoint}" with "params:{parameters}" and "headers:{headers}"';



loadTableData(url, searchText).then((data) => {
  if (data) {
      insertRowContentsIntoDiv(data);
      // console.log("Extracted Row Data:", data);
  }
});






// // Example usage with the found row
// const rowHtml = `
//   <td>Make an API call with "{method}" to "{endpoint}" with "params:{parameters}" and "headers:{headers}"</td>
//   <td>Create API step using this action where, the <code>method</code> is HTTP method (<code>GET, POST, PUT</code> or <code>DELETE</code>, etc), the endpoint is your API to be called (i.e.<code>https://petstore.swagger.io/v2/pet/59462342</code>)
//   <br>
//   <br>
//   <b>Optionally</b> you can set query parameters and headers using the format <code>Key=Value</code>, with semicolons <code>;</code> used to separate key-value pairs (e.g., <code>Key1=value1;Key2=value2</code>)
//   <br>
//   <br>The Request and Response data from the last API call will be stored in memory, which can be accessed using the steps below
//   </td>
//   <td>
//   <br><br><b>Example 1</b>
//   <br> <code>Make an API call with "GET" to "https://petstore.swagger.io/v2/pet/59462342"</code>
//   <br><br><b>Example 2</b>
//   <br> <code>Make an API call with "GET" to "https://petstore.swagger.io/v2/pet/59462342" with "params:param1=value1;param2=value2"</code>
//   <br><br><b>Example 3</b>
//   <br> <code>Make an API call with "GET" to "https://petstore.swagger.io/v2/pet/59462342" with "params:param1=value1;param2=value2" and "headers:header1=value1;header2=value2"</code>
//   </td>
// `;
// insertRowContentsIntoDiv(rowHtml);
