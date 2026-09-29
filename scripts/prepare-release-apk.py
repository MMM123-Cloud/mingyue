"""Build sqlite-vec v0.1.7-alpha.2 for 16KB Android pages.

Run before Gradle. --apk/--output also fixes an already-built APK and realigns it;
that output must be signed again before installation.
"""
from pathlib import Path
from zipfile import ZipFile
import argparse, json, platform, shutil, struct, subprocess, tempfile

ROOT = Path(__file__).resolve().parent.parent
TARGETS = {'arm64-v8a': 'aarch64-linux-android24', 'x86_64': 'x86_64-linux-android24'}

def alignments(raw):
    if raw[:6] != b'\x7fELF\x02\x01':
        raise RuntimeError('Expected a 64-bit little-endian ELF library')
    offset = struct.unpack_from('<Q', raw, 32)[0]
    size, count = struct.unpack_from('<HH', raw, 54)
    return [struct.unpack_from('<Q', raw, offset + i * size + 48)[0]
            for i in range(count) if struct.unpack_from('<I', raw, offset + i * size)[0] == 1]

def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sdk', type=Path, required=True)
    parser.add_argument('--ndk', default='27.1.12297006')
    parser.add_argument('--architectures', default='arm64-v8a,x86_64')
    parser.add_argument('--apk', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if bool(args.apk) != bool(args.output):
        parser.error('--apk and --output must be provided together')
    architectures = args.architectures.split(',')
    if not architectures or any(abi not in TARGETS for abi in architectures):
        parser.error('Supported architectures: arm64-v8a,x86_64')
    host = {'Windows': 'windows-x86_64', 'Linux': 'linux-x86_64', 'Darwin': 'darwin-x86_64'}[platform.system()]
    suffix = '.exe' if platform.system() == 'Windows' else ''
    tools = args.sdk / 'ndk' / args.ndk / 'toolchains/llvm/prebuilt' / host / 'bin'
    if not (tools / ('clang' + suffix)).is_file():
        raise RuntimeError('Install Android NDK ' + args.ndk + ' in the selected SDK first')
    sqlite = ROOT / 'node_modules/expo-sqlite'
    headers = sqlite / 'vendor/sqlite3'
    if not (headers / 'sqlite3.c').is_file():
        raise RuntimeError('Run npm ci before preparing the vector extension')
    built = {}
    with tempfile.TemporaryDirectory(prefix='mingyue-vec-') as temporary:
        temporary = Path(temporary)
        # Expo prefixes exported SQLite functions. Extension calls use the API
        # table, so restore the public names in headers without linking SQLite.
        generated_headers = temporary / 'headers'
        generated_headers.mkdir()
        (generated_headers / 'sqlite3.h').write_text((headers / 'sqlite3.h').read_text(encoding='utf-8').replace('exsqlite3', 'sqlite3'), encoding='utf-8')
        amalgamation = (headers / 'sqlite3.c').read_text(encoding='utf-8')
        begin = amalgamation.index('/************** Begin file sqlite3ext.h')
        end_marker = '#endif /* SQLITE3EXT_H */'
        end = amalgamation.index(end_marker, begin) + len(end_marker)
        extension_header = amalgamation[begin:end].replace('/* #include "sqlite3.h" */', '#include "sqlite3.h"').replace('exsqlite3', 'sqlite3')
        (generated_headers / 'sqlite3ext.h').write_text(extension_header, encoding='utf-8')
        for abi in architectures:
            library = temporary / abi / 'vec.so'
            library.parent.mkdir()
            subprocess.run([str(tools / ('clang' + suffix)), '--target=' + TARGETS[abi],
                            '-shared', '-fPIC', '-O2', '-I' + str(generated_headers),
                            str(ROOT / 'vendor/sqlite-vec/sqlite-vec.c'), '-o', str(library),
                            '-Wl,-z,max-page-size=16384', '-Wl,-z,common-page-size=16384',
                            '-Wl,-soname,libvec.so', '-lm'], check=True)
            subprocess.run([str(tools / ('llvm-strip' + suffix)), '--strip-unneeded', str(library)], check=True)
            pages = alignments(library.read_bytes())
            if not pages or any(page < 16384 for page in pages):
                raise RuntimeError('16KB alignment failed: ' + abi)
            destination = sqlite / 'android/vec' / abi / 'vec.so'
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(library, destination)
            # Android's native loader requires the conventional lib prefix.
            shutil.copy2(library, destination.with_name('libvec.so'))
            built[abi] = destination
        if args.apk:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            if args.apk.resolve() == args.output.resolve():
                raise RuntimeError('Use a separate output path; signing must follow alignment')
            unsigned = temporary / 'unsigned.apk'
            replacements = {'lib/' + abi + '/' + name: path for abi, path in built.items()
                            for name in ['vec.so', 'libvec.so']}
            replaced = set()
            with ZipFile(args.apk) as source, ZipFile(unsigned, 'w') as output:
                for item in source.infolist():
                    if item.filename.startswith('META-INF/') and (item.filename.endswith(('.RSA', '.DSA', '.EC', '.SF')) or item.filename == 'META-INF/MANIFEST.MF'):
                        continue
                    if item.filename in replacements:
                        output.writestr(item, replacements[item.filename].read_bytes())
                        replaced.add(item.filename)
                    else:
                        with source.open(item) as input_file, output.open(item, 'w') as output_file:
                            shutil.copyfileobj(input_file, output_file, length=1024 * 1024)
                for name, path in replacements.items():
                    if name not in replaced and name.endswith('/libvec.so'):
                        output.writestr(name, path.read_bytes())
                        replaced.add(name)
            if replaced != set(replacements):
                raise RuntimeError('The APK does not contain all requested vector libraries')
            zipalign = args.sdk / 'build-tools/36.0.0' / ('zipalign' + suffix)
            subprocess.run([str(zipalign), '-f', '-P', '16', '4', str(unsigned), str(args.output)], check=True)
            subprocess.run([str(zipalign), '-c', '-P', '16', '4', str(args.output)], check=True)
    print(json.dumps({'sqlite_vec_version': '0.1.7-alpha.2', 'architectures': architectures,
                      'elf_load_alignment': 16384, 'aligned_apk': str(args.output) if args.output else None}))

if __name__ == '__main__':
    run()
