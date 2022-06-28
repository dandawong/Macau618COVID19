const https = require('https'); // or 'https' for https:// URLs
const fs = require('fs');
const path = require('path');

const targetUrl = 'https://www.ssm.gov.mo/apps1/content/ch/23555/grid.aspx?dlimit=0&withattach=true&header=false&footer=false'
const outputFolder = 'pdf'
const rePdfLink = new RegExp(/https:\/\/www\.ssm\.gov\.mo.*\.pdf/gm)

var hrefList = []
var fileList = []

// Create output folder it not exist
if (!fs.existsSync(outputFolder)){
  fs.mkdirSync(outputFolder);
}

// Clear all pdf file
fs.readdir(outputFolder, (err, files) => {
  if (err) throw err;
  for (const file of files) {
    fs.unlink(path.join(outputFolder, file), err => {
      if (err) throw err;
    });
  }
});

const request = https.get(targetUrl, function (res) {
  let htmlContent = '';

  res.on('data', (data) => {
    htmlContent += data.toString();
  });

  res.on('end', () => {
    let linkSet = new Set()
    matches = htmlContent.match(rePdfLink)
    hrefList = [...new Set(matches)];
    // download pdf
    hrefList.forEach(function (url, index) {
      let filename = url.split('/').pop();

      // add to fileList
      fileList.push({fileName: filename, url: url})

      const file = fs.createWriteStream(outputFolder + '/' + filename);
      const request = https.get(url, function(response) {
         response.pipe(file);
         // after download completed close filestream
         file.on("finish", () => {
             file.close();
             console.log(filename + " Download Completed");
         });
      });
    })

    // output fileList to json
    fs.writeFile("./fileList.json", JSON.stringify(fileList, null, 2), (err) => {
      if (err) {
        console.error(err);
        return;
      };
      console.log("File List has been created");
    });
  });
});
