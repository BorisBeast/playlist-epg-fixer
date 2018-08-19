import fs from 'fs';
import { find } from 'lodash';
import { promisify } from 'util';
import XmlReader from 'xml-reader';
import FuzzyMatching from 'fuzzy-matching';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

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
    const epgChannelNames = epgChannels.map(channel => channel.displayName);

    const fm = new FuzzyMatching(channelNames);
    const matches = [];
    epgChannelNames.forEach(channel => {
      matches.push({channel, match: fm.get(channel).value});
    });

    return writeFile('./output.json', JSON.stringify(matches));
  })
  .then(() => {
    console.log('Write matches: DONE');
  });
