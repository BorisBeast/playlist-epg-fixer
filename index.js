import fs from 'fs';
import { find } from 'lodash';
import { promisify } from 'util';
import XmlReader from 'xml-reader';

const readFile = promisify(fs.readFile);

let originalM3u = '';
const channelNames = [];
const epgChannels = [];

readFile('./tv_channels.m3u', 'utf8')
  .then(data => {
    originalM3u = data.replace(/\r\n/g, '\n');
    const lines = originalM3u.split('\n');
    lines.forEach(line => {
      const match = /^#EXTINF.*,(.*)$/.exec(line); // TODO: what if there is a comma in parameters (in quotes) ?
      if (match) channelNames.push(match[1]);
    });

    console.log('Channels from m3u: DONE');
    return readFile('./epg.xml', 'utf8');
  })
  .then(data => {
    const reader = XmlReader.create({ stream: true, parentNodes: false });

    reader.on('tag:channel', tag => {
    const id = tag.attributes.id;
    const displayNameTag = find(tag.children, ['name', 'display-name']);
    const displayName = find(displayNameTag.children, ['type', 'text']).value;
      epgChannels.push({ id, displayName });
    });

    const donePromise = new Promise(resolve => {
      reader.on('done', resolve);
  });

  reader.parse(data);

    return donePromise;
  })
  .then(() => {
    console.log('Channels from epg: DONE');
});
