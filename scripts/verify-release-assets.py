"""Verify the two native packages and bootstrap assets before publication."""
import argparse
import hashlib
import json
import pathlib
import tarfile

parser = argparse.ArgumentParser()
parser.add_argument('directory', type=pathlib.Path)
parser.add_argument('version')
parser.add_argument('commit')
args = parser.parse_args()
manifests = []
for platform in ['darwin-arm64', 'linux-amd64']:
    name = f'n-ein-{args.version}-{platform}.tar.gz'
    archive = args.directory / name
    checksum = archive.with_name(name + '.sha256').read_text().split()
    assert checksum == [hashlib.sha256(archive.read_bytes()).hexdigest(), name], name
    with tarfile.open(archive) as tar:
        prefix = name.removesuffix('.tar.gz') + '/'
        manifest = json.load(tar.extractfile(prefix + 'package-manifest.json'))
        assert manifest['version'] == args.version and manifest['commit'] == args.commit
        records = {f['path']: f for f in manifest['files']}
        regular = {m.name for m in tar.getmembers() if m.isfile()}
        assert regular == {prefix + p for p in records} | {prefix + 'package-manifest.json'}, 'unexpected payload'
        for path, record in records.items():
            member = tar.getmember(prefix + path)
            assert member.isfile() and member.mode & 0o777 == record['mode'], path
            assert hashlib.sha256(tar.extractfile(member).read()).hexdigest() == record['sha256'], path
        installer_name = f'n-ein-install-{args.version}-{platform}'
        installer = args.directory / installer_name
        digest = hashlib.sha256(installer.read_bytes()).hexdigest()
        assert digest == records['bin/n-ein-install']['sha256']
        assert installer.with_name(installer_name + '.sha256').read_text().split() == [digest, installer_name]
        manifests.append(records)
assert manifests[0].keys() == manifests[1].keys(), 'different payloads between platforms'
for path in manifests[0]:
    if path not in ['bin/n-ein', 'bin/n-ein-install']:
        assert manifests[0][path] == manifests[1][path], path
assert f'bootstrap_tag="v{args.version}"' in (args.directory / 'install.sh').read_text()
print('Release assets: same source, payload, hashes, modes and matching bootstrap installers: OK')
