# H5P Interactive Video

Put texts, tasks and other media on top of your video.

[See it in action on H5P.org](https://h5p.org/interactive-video)

## Contributing

Translators, make sure to read through the [tips for language contributors](https://h5p.org/contributing). A good approach is to check that the updated language file matches the structure of the [norwegian translation](language/nn.json).  

Developers, take a look at the [developer guide](https://h5p.org/developers) which has information on [coding guidelines](https://h5p.org/code-style), [api-references](https://h5p.org/documentation/api/H5P.html) and much more. Before submitting pull-requests, please consider [testing your code thoroughly](https://github.com/h5p/h5p-interactive-video/wiki/Interactive-Video-Testplan-(November-2106-Release)) to speed up the review process.


## Building the distribution files
Downloading these files will not provide you with h5p libraries that you can upload to your system. They will have to be built and packed first.

Pull or download this archive files and go into the main folder. There run

```bash
npm install
```

to get the required modules. Then build the project using

```bash
npm run build
```

or

```bash
npm run watch
```

You can then use [H5P cli](https://github.com/h5p/h5p-cli) to pack the library e.g. using

```
h5p pack -r <library folder> <output file>
```

Alternatively, you can arrange and zip files manually, but make sure to adhere to the [H5P specification](https://h5p.org/documentation/developers/h5p-specification).

## License

(The MIT License)

Copyright (c) 2012-2014 Joubel AS

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
