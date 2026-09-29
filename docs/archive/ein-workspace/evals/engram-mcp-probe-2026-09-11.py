"""Read only MCP probe against the disposable CLI fixture, not personal memory."""
import json
import os
import pathlib
import subprocess
import sys
import select

fixture = json.loads(pathlib.Path(sys.argv[1]).read_text())
env = dict(os.environ, ENGRAM_DATA_DIR=fixture['store'], ENGRAM_NO_UPDATE_CHECK='1')
env.pop('ENGRAM_CLOUD_AUTOSYNC', None)
p = subprocess.Popen(['engram', 'mcp', '--project', 'ein-memory-eval'], env=env,
                     stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
counter = 0
buffer = b''

def request(method, params):
    global counter, buffer
    counter += 1
    p.stdin.write((json.dumps(dict(jsonrpc='2.0', id=counter, method=method, params=params)) + '\n').encode())
    p.stdin.flush()
    while True:
        if b'\n' not in buffer:
            if not select.select([p.stdout], [], [], 10)[0]:
                raise TimeoutError(method)
            chunk = os.read(p.stdout.fileno(), 65536)
            if not chunk:
                raise RuntimeError('MCP exited')
            buffer += chunk
            continue
        line, buffer = buffer.split(b'\n', 1)
        message = json.loads(line)
        if message.get('id') == counter:
            return message

try:
    init = request('initialize', dict(protocolVersion='2024-11-05', capabilities={}, clientInfo=dict(name='ein-eval', version='1')))
    p.stdin.write(b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n')
    p.stdin.flush()
    listing = request('tools/list', {})
    search_schema = next(t for t in listing['result']['tools'] if t['name'] == 'mem_search')
    results = []
    for query in ['zzznomatchzzz', 'compactacion']:
        args = dict(query=query, project='ein-memory-eval', limit=5)
        if 'response_format' in search_schema['inputSchema'].get('properties', {}):
            args['response_format'] = 'compact'
        results.append(dict(query=query, response=request('tools/call', dict(name='mem_search', arguments=args))))
    full = request('tools/call', dict(name='mem_get_observation', arguments=dict(id=1)))
    output = dict(server=init, search_schema=search_schema, results=results, full=full)
    pathlib.Path(sys.argv[2]).write_text(json.dumps(output, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps(output, indent=2, ensure_ascii=False))
finally:
    p.terminate()
    p.wait(timeout=5)
