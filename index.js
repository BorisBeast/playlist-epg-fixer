import fs from 'fs';
import XmlReader from 'xml-reader';
import { find } from 'lodash';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

const reader = XmlReader.create({stream: true});



readFile('./epg.xml', 'utf8').then(data => {
  reader.on('tag:channel', (tag) => {
    const id = tag.attributes.id;
    const displayNameTag = find(tag.children, ['name', 'display-name']);
    const displayName = find(displayNameTag.children, ['type', 'text']).value;
    console.log('id=', id, 'displayName=', displayName);
  });
  reader.parse(data);
});
