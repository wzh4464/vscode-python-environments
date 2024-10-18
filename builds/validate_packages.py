import json
import pathlib
import urllib
import urllib.request as url_lib

def _get_pypi_package_data(package_name):
    json_uri = "https://pypi.org/pypi/{0}/json".format(package_name)
    # Response format: https://warehouse.readthedocs.io/api-reference/json/#project
    # Release metadata format: https://github.com/pypa/interoperability-peps/blob/master/pep-0426-core-metadata.rst
    with url_lib.urlopen(json_uri) as response:
        return json.loads(response.read())

packages = (pathlib.Path(__file__).parent.parent / "files" / "pip_packages.txt").read_text(encoding="utf-8").splitlines()
valid_packages = []


def validate_package(package):
    try:
        data = _get_pypi_package_data(package)
        num_versions = len(data["releases"])
        return num_versions > 1 
    except urllib.error.HTTPError:
        return False


for pkg in packages:
    if(validate_package(pkg)):
        print(pkg)
        valid_packages.append(pkg)

(pathlib.Path(__file__).parent / "valid_pip_packages.txt").write_text('\n'.join(valid_packages), encoding="utf-8")