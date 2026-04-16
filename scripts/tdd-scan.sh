#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
import json
import re
from pathlib import Path

root = Path('.').resolve()

indicator_files = [
    ('dotnet', ['*.sln', '*.csproj']),
    ('node', ['package.json']),
    ('python', ['pyproject.toml', 'requirements.txt']),
    ('java-maven', ['pom.xml']),
    ('java-gradle', ['build.gradle', 'build.gradle.kts']),
]

found = {}
for key, patterns in indicator_files:
    matches = []
    for pattern in patterns:
        matches.extend(root.rglob(pattern))
    found[key] = len(matches) > 0

def detect_test_runner() -> str | None:
    if found['dotnet']:
        return 'dotnet test'
    if found['node']:
        pkg_files = list(root.rglob('package.json'))
        for pkg in pkg_files[:5]:
            try:
                data = json.loads(pkg.read_text(encoding='utf-8'))
            except Exception:
                continue
            deps = {}
            for section in ('dependencies', 'devDependencies', 'peerDependencies'):
                if isinstance(data.get(section), dict):
                    deps.update(data[section])
            scripts = data.get('scripts', {}) if isinstance(data.get('scripts'), dict) else {}
            if 'vitest' in deps:
                return 'npx vitest run'
            if 'jest' in deps:
                return 'npm test'
            test_script = scripts.get('test')
            if isinstance(test_script, str) and test_script.strip():
                return 'npm test'
        return 'npm test'
    if found['python']:
        return 'pytest'
    if found['java-maven']:
        return 'mvn test'
    if found['java-gradle']:
        return './gradlew test'
    return None

common_test_dirs = ['tests', 'test', '__tests__', 'spec']
def detect_test_dir() -> str | None:
    for d in common_test_dirs:
        matches = list(root.rglob(d))
        for m in matches:
            if m.is_dir():
                try:
                    rel = m.relative_to(root).as_posix().rstrip('/') + '/'
                    return rel
                except Exception:
                    continue
    return None

test_file_patterns = ['*test*.cs', '*test*.js', '*test*.ts', 'test_*.py', '*Test.java', '*Tests.java', '*Spec.java']
all_test_files = []
for pattern in test_file_patterns:
    all_test_files.extend([p for p in root.rglob(pattern) if p.is_file()])

# include common directory conventions
for d in ['tests', 'test', '__tests__', 'spec']:
    for p in root.rglob(f'{d}/**/*'):
        if p.is_file() and p.suffix.lower() in {'.cs', '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.kt'}:
            all_test_files.append(p)

# de-dup preserve order
seen = set()
unique_test_files = []
for p in all_test_files:
    rp = str(p)
    if rp in seen:
        continue
    seen.add(rp)
    unique_test_files.append(p)

sample_files = unique_test_files[:20]

pattern_counts = {
    'WhenCondition_ShouldExpectedOutcome': 0,
    'Given_When_Then': 0,
    'test_function_style': 0,
    'it_should_style': 0,
}

assertion_signatures = {
    'Shouldly': [r'\bShould\w*\('],
    'FluentAssertions': [r'\.Should\(\)'],
    'xUnit/NUnit assertions': [r'\bAssert\.[A-Za-z]+\('],
    'Jest expect': [r'\bexpect\s*\('],
    'Chai': [r'\bchai\b', r'\bexpect\s*\('],
    'pytest/assert': [r'\bassert\s+'],
    'AssertJ': [r'\bassertThat\s*\('],
    'JUnit assertions': [r'\bAssertions\.[A-Za-z]+\('],
}
mock_signatures = {
    'Moq': [r'\bMoq\b', r'\bMock<'],
    'NSubstitute': [r'\bNSubstitute\b', r'\bSubstitute\.For'],
    'Jest mocks': [r'\bjest\.mock\(', r'\bjest\.fn\('],
    'Sinon': [r'\bsinon\b'],
    'unittest.mock': [r'\bunittest\.mock\b', r'\bmock\.[A-Za-z]+'],
    'Mockito': [r'\bMockito\b', r'\bmock\s*\('],
}

assertion_hits = {k: 0 for k in assertion_signatures}
mock_hits = {k: 0 for k in mock_signatures}

for f in sample_files:
    try:
        text = f.read_text(encoding='utf-8', errors='ignore')
    except Exception:
        continue

    pattern_counts['WhenCondition_ShouldExpectedOutcome'] += len(re.findall(r'\bWhen[A-Za-z0-9_]*_Should[A-Za-z0-9_]*\b', text))
    pattern_counts['Given_When_Then'] += len(re.findall(r'\bGiven[A-Za-z0-9_]*_When[A-Za-z0-9_]*_Then[A-Za-z0-9_]*\b', text))
    pattern_counts['test_function_style'] += len(re.findall(r'\bdef\s+test_[A-Za-z0-9_]*\s*\(', text))
    pattern_counts['it_should_style'] += len(re.findall(r'\bit\s*\(\s*["\']should\b', text, flags=re.IGNORECASE))

    for lib, sigs in assertion_signatures.items():
        for sig in sigs:
            assertion_hits[lib] += len(re.findall(sig, text))

    for lib, sigs in mock_signatures.items():
        for sig in sigs:
            mock_hits[lib] += len(re.findall(sig, text))

naming_pattern = None
if max(pattern_counts.values(), default=0) > 0:
    naming_pattern = max(pattern_counts.items(), key=lambda kv: kv[1])[0]

assertion_lib = None
if max(assertion_hits.values(), default=0) > 0:
    assertion_lib = max(assertion_hits.items(), key=lambda kv: kv[1])[0]

mock_lib = None
if max(mock_hits.values(), default=0) > 0:
    mock_lib = max(mock_hits.items(), key=lambda kv: kv[1])[0]

existing_project = any(found.values()) or len(unique_test_files) > 0

result = {
    'mode': 'existing-project' if existing_project else 'new-project',
    'testRunner': detect_test_runner(),
    'testWorkingDir': '.',
    'testDir': detect_test_dir(),
    'namingPattern': naming_pattern,
    'assertionLib': assertion_lib,
    'mockLib': mock_lib,
    'existingTestCount': len(unique_test_files),
    'detected': [],
}

for field in ('testRunner', 'testWorkingDir', 'testDir', 'namingPattern', 'assertionLib', 'mockLib'):
    if result.get(field):
        result['detected'].append(field)

print(json.dumps(result, indent=2))
PY
