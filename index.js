const fs = require('fs');
const pdf = require('pdf-parse');

// Input pdfs path
const pdfPath = 'pdf'
const pdfCount = fs.readdirSync(pdfPath).filter(fileName => fileName.includes('.pdf')).length

// Utility function
function matchText(target, regex, index) {
  let match = target.match(regex)
  if (match != null) {
    return match[index]
  } else {
    return null
  }
}

// Handle special case
// case 29
function fixSpecialCase(text) {
  if (text.includes('29-618')) {
    text = text.replace(/6月15\-\s+/gm, '6月15\-')
    text = text.replace(/6月15\-18日/gm, '6月15\-18日 \-\- ')
  }

  if (text.includes('159-618')) {
    text = text.replace('2022/06/234', '2022/06/23')
  }

  if (text.includes('151-618')) {
    text = text.replace('2021/6/24', '2022/6/24')
  }

  if (text.includes('79-618')) {
    text = text.replace('澳門癗漢', '澳門𧙗漢')
  }

  return text
}

const dir = fs.opendirSync(pdfPath)

personInfoList = []

let dirent
while ((dirent = dir.readSync()) !== null) {
  let path = pdfPath + '/' + dirent.name
  let dataBuffer = fs.readFileSync(path);

  if (!dirent.name.includes('.pdf')) {
    continue;
  }

  const fileName = dirent.name

  pdf(dataBuffer).then(function (data) {
    // number of pages
    let numberPages = data.numpages
    // PDF text
    let text = (data.text);

    // Clean text

    // Clean page number
    for (let i = 1; i <= numberPages; i++) {
      let target = i.toString() + "\/" + numberPages.toString()
      text = text.replace(target, '');
    }

    // Clean header
    let cleanTargetList = ['澳 門 特 別 行 政 區 政 府', 'Governo da Região Administrativa Especial de Macau', '衛     生     局', 'Serviços de Saúde']
    cleanTargetList.forEach(function (item, index) {
      var re = new RegExp(item, 'g');
      text = text.replace(re, '');
    })

    text = text.replace(/性名：\s+/gm, '性名：')
    text = text.replace(/性別：\s+/gm, '性別：')
    text = text.replace(/年齡：\s+/gm, '年齡：')
    text = text.replace(/證件類別或國籍：\s+/gm, '證件類別或國籍：')
    text = text.replace(/住址\s*:\s+/gm, '住址:')
    text = text.replace(/年齡：\s+/gm, '年齡：')
    text = text.replace(/核酸檢測陽性日期：\s+/gm, '核酸檢測陽性日期：')

    // Fix special case
    text = fixSpecialCase(text)

    // console.log(text)

    // Clean space
    textList = text.split("\n");
    textList = textList.filter(text => text.trim().length != 0)

    // Parse data
    var reCode = new RegExp(/個案編號: (\d*-\d*)/)
    var reLastUpdateDate = new RegExp(/更新日期: (\d*年\d*月\d*日)/)
    var reName = new RegExp(/姓名：\s*(.*)/)
    var reSex = new RegExp(/性別：\s*(.*)/)
    var reAge = new RegExp(/年齡：\s*(.*)/)
    var reAddress = new RegExp(/住址\s*:\s*(.*)/)
    var reRegion = new RegExp(/證件類別或國籍：\s*(.*)/)
    var rePositiveDate = new RegExp(/核酸檢測陽性日期：\s*(.*)/)

    var reTraceStart = new RegExp('日期 時間 行程')
    var reTraceStart2 = new RegExp('二、 近期行程 :\s*')
    var reDateSpecial = new RegExp(/\d+月\d+\-/)
    var reDate = new RegExp(/^\d+\s*月\d+\s*日\s+|^\d+\/\d+\/\d+|^\d+\/\d+|\d+月\d+-\d+日\s/)
    var reTime = new RegExp(/^(\d+:\d+|全天|中午\-晚上|早上|--|\d+:\d+|中午|上午|下午|晚上|全日|\d+:\d+\-\d+:\d+|\d+:\d+\-|\d*:\d*~\d*:\d*|早上至晚上|\d+:\d+至\d+:\d+)\s+/)

    personInfo = {}
    personTrace = []

    let traceStart = false;
    let currentDate = null
    let currentTime = null

    // console.log(textList)

    textList.forEach(function (text, index) {
      let code = matchText(text, reCode, 1)
      if (code) personInfo.code = code

      let lastUpdateDate = matchText(text, reLastUpdateDate, 1)
      if (lastUpdateDate) personInfo.lastUpdateDate = lastUpdateDate

      let name = matchText(text, reName, 1)
      if (name) personInfo.name = name.trim()

      let sex = matchText(text, reSex, 1)
      if (sex) personInfo.sex = sex.trim()

      let age = matchText(text, reAge, 1)
      if (age) personInfo.age = age.trim()

      let address = matchText(text, reAddress, 1)
      if (address) personInfo.address = address.trim()

      let region = matchText(text, reRegion, 1)
      if (region) personInfo.region = region.trim()

      let positiveDate = matchText(text, rePositiveDate, 1)
      if (positiveDate) personInfo.positiveDate = positiveDate.trim()

      if (text.match(reDateSpecial)) personInfo.dateSpecial = true

      if (text.match(reTraceStart) || text.match(reTraceStart2)) {
        traceStart = true
      }

      if (traceStart) {
        let date = text.match(reDate)
        if (date) {
          currentDate = date[0]
          text = text.substring(currentDate.length)
        }

        let time = text.match(reTime)
        if (time) {
          currentTime = time[0]
          text = text.substring(currentTime.length)
        }

        content = text

        if (content.trim().length > 0 && currentDate != null) {
          let trace = {}
          trace.date = currentDate.trim()
          trace.time = currentTime.trim()
          trace.content = content.trim()
          personTrace.push(trace)
        }
      }
    })

    personInfo.trace = personTrace
    return personInfo
  }).then(function (personInfo) {
    personInfoList.push(personInfo)
  }).then(function () {
    if (personInfoList.length >= pdfCount) {
      // console.log(JSON.stringify(personInfoList, null, 2))
      fs.writeFile("./positiveList.json", JSON.stringify(personInfoList, null, 2), (err) => {
        if (err) {
          console.error(err);
          return;
        };
        console.log("File has been created");
      });
    }
  });
}

dir.closeSync()