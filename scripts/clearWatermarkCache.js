const mongoose = require('mongoose')
mongoose.connect('mongodb+srv://samalgorakhnath8_db_user:MNcZ72L8oQkY3vSv@cluster0.pnn35fy.mongodb.net/ats_kmc?appName=Cluster0').then(async () => {
  const r = await mongoose.connection.db.collection('filestores').deleteMany({ filename: { $regex: /^(wm_|masked_wm_)/ } })
  console.log('Deleted', r.deletedCount, 'cached watermark files')
  process.exit(0)
}).catch(e => { console.error(e); process.exit(1) })
