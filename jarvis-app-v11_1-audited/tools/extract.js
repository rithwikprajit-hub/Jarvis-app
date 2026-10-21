// Concatenates every inline <script> from ../index.html into all.js for linting.
const fs=require('fs'); const L=fs.readFileSync('../index.html','utf8').split('\n'); const out=[]; let a=-1;
L.forEach((l,i)=>{ if(l.trim()==='<script>') a=i; else if(l.trim()==='</script>'&&a>=0){ out.push(L.slice(a+1,i).join('\n')); a=-1; } });
fs.writeFileSync('all.js',out.join('\n')); console.log('wrote all.js from',out.length,'script blocks');
