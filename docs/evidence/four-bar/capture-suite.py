from pathlib import Path
import subprocess, hashlib, json, datetime, time, shutil

root = Path('/Users/amb/Documents/New project/KinetiCAD-review-20260911')
app = root / 'artifacts/kineticad'
out = Path('/tmp/kineticad-four-bar-suite')
sha = lambda data: hashlib.sha256(data).hexdigest()
tracked = subprocess.check_output(['git','ls-files','-z','docs','artifacts/kineticad/tests/fixtures'], cwd=root).decode().split('\0')
paths = [root / p for p in tracked if p and (p.endswith('.json') or p.startswith('artifacts/kineticad/tests/fixtures/'))]
saved = {str(p.relative_to(root)): p.read_bytes() for p in paths if p.is_file()}
for name, data in saved.items():
    target=out/'before'/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
tests = sorted(str(p.relative_to(app)) for p in (app/'tests').glob('*.test.mjs'))
command = ['node','--import','../../scripts/node_modules/tsx/dist/loader.mjs','--test','--test-concurrency=1',f'--test-reporter={out}/reporter.mjs',*tests]
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
began=time.monotonic()
meta = {'startedAt':start,'commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'cwd':str(app),'command':command,
 'nodeVersion':subprocess.check_output(['node','--version'],text=True).strip(),'pnpmVersion':subprocess.check_output(['pnpm','--version'],cwd=root,text=True).strip(),
 'testFiles':tests,'beforeArtifactHashes':{p:sha(data) for p,data in saved.items()},'reporterSha256':sha((out/'reporter.mjs').read_bytes())}
meta['sourceInputSha256']={str(p.relative_to(root)):sha(p.read_bytes()) for base in [root/'artifacts/kineticad/src',root/'artifacts/kineticad/tests'] for p in base.rglob('*') if p.is_file()}
(out/'run-start.json').write_text(json.dumps(meta,indent=2)+'\n')
try:
    with (out/'events.jsonl').open('wb') as events, (out/'stderr.log').open('wb') as errors:
        completed=subprocess.run(command,cwd=app,stdout=events,stderr=errors)
        meta['exitCode']=completed.returncode
finally:
    meta['completedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();meta['wallDurationMs']=(time.monotonic()-began)*1000
    generated=[]
    for name,original in saved.items():
        current=(root/name).read_bytes()
        if current != original:
            fresh=out/'generated'/name;fresh.parent.mkdir(parents=True,exist_ok=True);fresh.write_bytes(current)
            generated.append({'path':name,'historicalSha256':sha(original),'generatedSha256':sha(current),'restored':True})
            (root/name).write_bytes(original)
    meta['generatedArtifactsRestored']=generated
    meta['restorationVerified']=all((root/name).read_bytes()==data for name,data in saved.items())
    meta['sourceInputsUnchanged']=all((root/p).exists() and sha((root/p).read_bytes())==h for p,h in meta['sourceInputSha256'].items())
    meta['rawReporterSha256']=sha((out/'events.jsonl').read_bytes())
    (out/'run-metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps({'exitCode':meta.get('exitCode'),'wallDurationMs':meta['wallDurationMs'],'restorationVerified':meta['restorationVerified'],'generatedArtifactsRestored':meta['generatedArtifactsRestored']},indent=2))
