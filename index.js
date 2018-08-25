import fs from 'fs';
import { find } from 'lodash';
import { promisify } from 'util';
import XmlReader from 'xml-reader';
import FuzzyMatching from 'fuzzy-matching';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

let originalM3u = '';
const m3uChannels = [];
const epgChannels = [];

readFile('./tv_channels.m3u', 'utf8')
  .then(data => {
    originalM3u = data.replace(/\r\n/g, '\n');
    const lines = originalM3u.split('\n');

    let hadExtInf = false;
    let channelName = '';
    let group = '';
    lines.forEach(line => {
      let match = /^#EXTINF.*,(.*)$/.exec(line);
      if (match) {
        hadExtInf = true;
        channelName = match[1];
      } else {
        if (hadExtInf && !!channelName) {
          match = /<.+?>(.+?)<.+?>/.exec(channelName);
          if (match) {
            group = match[1].trim();
          }
          m3uChannels.push({ name: channelName, link: line, group: match ? '' : group, id: null });
        }
        hadExtInf = false;
        channelName = '';
      }
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

    const fm = new FuzzyMatching(epgChannelNames);
    const matches = [];
    m3uChannels.forEach(channel => {
      const match = fm.get(channel.name);
      matches.push({...channel, distance: match.distance, ...find(epgChannels, ['displayName', match.value])});
    });

    return writeFile('./output.json', JSON.stringify(matches));
  })
  .then(() => {
    console.log('Write matches: DONE');
  });
